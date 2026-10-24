begin;
create table public.followup_resolutions (
 tenant_id uuid not null,
 id uuid not null,
 source_trip uuid not null,
 customer_id uuid not null,
 source_version integer not null,
 target_trip uuid,
 actor_id uuid not null references auth.users(id),
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 unique(tenant_id,source_trip,customer_id,source_version),
 foreign key(tenant_id,source_trip,customer_id) references public.route_stops(tenant_id,trip_id,customer_id),
 foreign key(tenant_id,target_trip) references public.inventory_trips(tenant_id,id)
);
alter table public.followup_resolutions enable row level security;
create policy followup_resolutions_read on public.followup_resolutions for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.followup_resolutions from public,anon,authenticated;
grant select on public.followup_resolutions to authenticated;

create function public.owner_followup_inbox(p_tenant uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede ver pendientes' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Pagina invalida'; end if;
 return (with pending as (
 select r.trip_id,c.id customer_id,c.name customer,c.address,c.pending_recovery,r.version,r.next_date,r.followup,t.name trip,t.status trip_status,
 coalesce((select e.data->>'note' from public.route_events e where e.tenant_id=r.tenant_id and e.trip_id=r.trip_id and e.customer_id=r.customer_id and e.action='absent' order by e.created_at desc,e.id desc limit 1),'') note,r.updated_at
 from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id join public.inventory_trips t on t.tenant_id=r.tenant_id and t.id=r.trip_id
 where r.tenant_id=p_tenant and r.active and r.outcome='absent' and c.active
 ) select jsonb_build_object('count',(select count(*) from pending),'items',coalesce((select jsonb_agg(to_jsonb(v) order by v.next_date,v.updated_at,v.trip_id,v.customer_id) from (select * from pending order by next_date,updated_at,trip_id,customer_id limit 20 offset p_offset) v),'[]'::jsonb)));
end $$;

create function public.owner_manage_followup(p_tenant uuid,p_id uuid,p_source_event uuid,p_target_event uuid,p_source_trip uuid,p_customer uuid,p_version integer,p_action text,p_target_trip uuid default null,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.followup_resolutions; source public.route_stops; target public.route_stops; trip public.inventory_trips; payload jsonb; receipt jsonb; position integer; day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede gestionar pendientes' using errcode='42501'; end if;
 if p_id is null or p_source_event is null or p_target_event is null or p_source_event=p_target_event or p_id in (p_source_event,p_target_event) or p_version is null or p_action is null or p_action not in ('assign','resolve') or p_note is null or length(p_note)>400 or (p_action='resolve' and (p_target_trip is not null or length(trim(p_note))=0)) or (p_action='assign' and (p_target_trip is null or p_target_trip=p_source_trip)) then raise exception 'Accion o motivo invalido'; end if;
 payload:=jsonb_build_object('source_event',p_source_event,'target_event',p_target_event,'action',p_action,'note',p_note);
 select * into previous from public.followup_resolutions where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.source_trip=p_source_trip and previous.customer_id=p_customer and previous.source_version=p_version and previous.target_trip is not distinct from p_target_trip and previous.request=payload then return previous.result; end if;
  raise exception 'ID de pendiente utilizado con otros datos';
 end if;
 select * into source from public.route_stops where tenant_id=p_tenant and trip_id=p_source_trip and customer_id=p_customer for update;
 if not found or not source.active or source.outcome<>'absent' or source.version<>p_version then raise exception 'El pendiente cambio o ya fue resuelto'; end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente inactivo'; end if;
 if exists(select 1 from public.route_events where tenant_id=p_tenant and id in (p_source_event,p_target_event)) then raise exception 'ID de evento utilizado'; end if;
 if p_action='assign' then
  select * into trip from public.inventory_trips where tenant_id=p_tenant and id=p_target_trip for update;
  if not found or trip.status not in ('planned','active') or trip.service_date<greatest(source.next_date,day) then raise exception 'Elegi otro reparto abierto, no anterior a la visita prevista ni a hoy'; end if;
  select * into target from public.route_stops where tenant_id=p_tenant and trip_id=p_target_trip and customer_id=p_customer;
  if found and (target.outcome not in ('pending','present') or (not target.active and target.outcome<>'pending')) then raise exception 'La parada destino tiene otro resultado o pendiente'; end if;
  if target.customer_id is null or not target.active then
   select coalesce(max(r.position),0)+1 into position from public.route_stops r where tenant_id=p_tenant and trip_id=p_target_trip;
   perform public.route_edit_stop(p_tenant,p_target_event,p_target_trip,p_customer,position,true,case when target.customer_id is null then null else target.version end);
  end if;
 end if;
 -- The origin may already be closed. Only remove it from the operational queue;
 -- preserve outcome, followup date, all events, financial and inventory history.
 update public.route_stops set active=false,version=version+1,updated_at=now() where tenant_id=p_tenant and trip_id=p_source_trip and customer_id=p_customer returning * into source;
 insert into public.route_events(tenant_id,id,trip_id,customer_id,actor_id,action,data)
 values(p_tenant,p_source_event,p_source_trip,p_customer,auth.uid(),'edit_stop',jsonb_build_object('active',false,'followup_action',p_action,'target_trip',p_target_trip,'expected_version',p_version,'result_version',source.version,'note',p_note));
 receipt:=jsonb_build_object('id',p_id,'action',p_action,'target_trip',p_target_trip,'source_version',source.version);
 insert into public.followup_resolutions(tenant_id,id,source_trip,customer_id,source_version,target_trip,actor_id,request,result) values(p_tenant,p_id,p_source_trip,p_customer,p_version,p_target_trip,auth.uid(),payload,receipt);
 return receipt;
end $$;
revoke all on function public.owner_followup_inbox(uuid,integer),public.owner_manage_followup(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,uuid,text) from public,anon,authenticated;
grant execute on function public.owner_followup_inbox(uuid,integer),public.owner_manage_followup(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
