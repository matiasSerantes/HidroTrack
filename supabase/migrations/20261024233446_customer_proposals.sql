begin;
create table public.customer_proposals (
 tenant_id uuid not null,
 id uuid not null,
 trip_id uuid not null,
 requested_by uuid not null references auth.users(id),
 name text not null,
 address text not null,
 phone text not null,
 locality text not null,
 latitude double precision,
 longitude double precision,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 decision_note text not null default '',
 target_trip uuid,
 customer_id uuid,
 decision_id uuid,
 decision_event uuid,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 foreign key(tenant_id,target_trip) references public.inventory_trips(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 check((status='pending' and reviewed_by is null and reviewed_at is null and decision_id is null and decision_event is null and target_trip is null and customer_id is null)
 or (status='rejected' and reviewed_by is not null and reviewed_at is not null and decision_id is not null and decision_event is not null and target_trip is null and customer_id is null)
 or (status='approved' and reviewed_by is not null and reviewed_at is not null and decision_id is not null and decision_event is not null and target_trip is not null and customer_id is not null))
);
create unique index customer_proposal_pending_once on public.customer_proposals(tenant_id,trip_id,requested_by,lower(trim(name)),lower(trim(address))) where status='pending';
create unique index customer_proposal_decision_once on public.customer_proposals(tenant_id,decision_id) where decision_id is not null;
alter table public.customer_proposals enable row level security;
create policy customer_proposals_owner on public.customer_proposals for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.customer_proposals from public,anon,authenticated;
grant select on public.customer_proposals to authenticated;

create function public.assistant_propose_customer(p_tenant uuid,p_id uuid,p_trip uuid,p_name text,p_address text,p_phone text,p_locality text,p_latitude double precision default null,p_longitude double precision default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.customer_proposals;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 100 or p_address is null or length(trim(p_address)) not between 1 and 200 or p_phone is null or length(p_phone)>60 or p_locality is null or length(p_locality)>120 then raise exception 'Datos del cliente invalidos'; end if;
 if (p_latitude is null)<>(p_longitude is null) or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then raise exception 'Coordenadas invalidas'; end if;
 select * into previous from public.customer_proposals where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.requested_by=auth.uid() and previous.trip_id=p_trip and previous.name=trim(p_name) and previous.address=trim(p_address) and previous.phone=trim(p_phone) and previous.locality=trim(p_locality) and previous.latitude is not distinct from p_latitude and previous.longitude is not distinct from p_longitude then return p_id; end if;
  raise exception 'ID de solicitud utilizado con otros datos';
 end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no activo'; end if;
 if exists(select 1 from public.customer_proposals where tenant_id=p_tenant and trip_id=p_trip and requested_by=auth.uid() and status='pending' and lower(trim(name))=lower(trim(p_name)) and lower(trim(address))=lower(trim(p_address))) then raise exception 'Ya enviaste esta solicitud pendiente'; end if;
 insert into public.customer_proposals(tenant_id,id,trip_id,requested_by,name,address,phone,locality,latitude,longitude)
 values(p_tenant,p_id,p_trip,auth.uid(),trim(p_name),trim(p_address),trim(p_phone),trim(p_locality),p_latitude,p_longitude);
 return p_id;
end $$;

create function public.customer_proposal_inbox(p_tenant uuid,p_trip uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare chief boolean:=private.has_role(p_tenant,array['owner']);
begin
 if not chief and (p_trip is null or not private.accepted_trip_access(p_tenant,p_trip)) then raise exception 'Solicitudes no accesibles' using errcode='42501'; end if;
 return (with visible as (
 select p.id,p.trip_id,p.name,p.address,p.phone,p.locality,p.latitude,p.longitude,p.status,p.decision_note,p.target_trip,p.customer_id,p.created_at,t.name trip,
 case when chief then coalesce(u.full_name,'Asistente') else null end assistant
 from public.customer_proposals p join public.inventory_trips t on t.tenant_id=p.tenant_id and t.id=p.trip_id left join public.user_profiles u on u.user_id=p.requested_by
 where p.tenant_id=p_tenant and (case when chief then p.status='pending' else p.trip_id=p_trip and p.requested_by=auth.uid() end)
 ) select jsonb_build_object('count',(select count(*) from visible),'items',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id) from (select * from visible order by created_at desc,id limit 20) v),'[]'::jsonb)));
end $$;

create function public.owner_review_customer_proposal(p_tenant uuid,p_id uuid,p_proposal uuid,p_event uuid,p_approve boolean,p_trip uuid default null,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare proposal public.customer_proposals; pos integer; decision text;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede aprobar clientes' using errcode='42501'; end if;
 if p_id is null or p_proposal is null or p_event is null or p_id=p_event or p_approve is null or p_note is null or length(p_note)>400 or (not p_approve and (p_trip is not null or length(trim(p_note))=0)) or (p_approve and p_trip is null) then raise exception 'Decision o motivo invalido'; end if;
 select * into proposal from public.customer_proposals where tenant_id=p_tenant and id=p_proposal for update;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 decision:=case when p_approve then 'approved' else 'rejected' end;
 if proposal.status<>'pending' then
  if proposal.status=decision and proposal.decision_id=p_id and proposal.decision_event=p_event and proposal.reviewed_by=auth.uid() and proposal.target_trip is not distinct from p_trip and proposal.decision_note=p_note then return p_proposal; end if;
  raise exception 'Solicitud ya resuelta';
 end if;
 if p_approve then
  if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status in ('planned','active')) then raise exception 'Elegi un reparto preparado o activo'; end if;
  if exists(select 1 from public.customers where tenant_id=p_tenant and active and lower(trim(name))=lower(proposal.name) and lower(trim(address))=lower(proposal.address)) then raise exception 'Ya existe un cliente con ese nombre y direccion; revisa antes de duplicarlo'; end if;
  if exists(select 1 from public.customers where id=p_proposal) then raise exception 'Identificador de cliente utilizado'; end if;
  insert into public.customers(id,tenant_id,name,address,phone,locality,latitude,longitude) values(p_proposal,p_tenant,proposal.name,proposal.address,proposal.phone,proposal.locality,proposal.latitude,proposal.longitude);
  select coalesce(max(position),0)+1 into pos from public.route_stops where tenant_id=p_tenant and trip_id=p_trip;
  perform public.route_edit_stop(p_tenant,p_event,p_trip,p_proposal,pos,true,null);
 end if;
 update public.customer_proposals set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),decision_note=p_note,decision_id=p_id,decision_event=p_event,target_trip=p_trip,customer_id=case when p_approve then p_proposal else null end where tenant_id=p_tenant and id=p_proposal;
 return p_proposal;
end $$;
revoke all on function public.assistant_propose_customer(uuid,uuid,uuid,text,text,text,text,double precision,double precision),public.customer_proposal_inbox(uuid,uuid),public.owner_review_customer_proposal(uuid,uuid,uuid,uuid,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.assistant_propose_customer(uuid,uuid,uuid,text,text,text,text,double precision,double precision),public.customer_proposal_inbox(uuid,uuid),public.owner_review_customer_proposal(uuid,uuid,uuid,uuid,boolean,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
