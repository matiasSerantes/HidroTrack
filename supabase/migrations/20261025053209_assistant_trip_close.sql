begin;
create table public.assistant_trip_close_snapshots(
 tenant_id uuid not null,id uuid not null,trip_id uuid not null,actor_id uuid not null references auth.users(id),
 request jsonb not null,snapshot jsonb not null,created_at timestamptz not null default now(),
 primary key(tenant_id,id),foreign key(tenant_id,id) references public.trip_closures(tenant_id,id),foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.assistant_trip_close_snapshots enable row level security;
create policy assistant_trip_close_snapshots_owner on public.assistant_trip_close_snapshots for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.assistant_trip_close_snapshots from public,anon,authenticated;
grant select on public.assistant_trip_close_snapshots to authenticated;

-- Load snapshots contain private costs. Only these three initial-load fields
-- may be copied into an assistant's close preview or shared receipt.
create function private.assistant_close_quote(t uuid,r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select q||jsonb_build_object('initial_load',coalesce((select jsonb_agg(jsonb_build_object('product_id',i->>'product_id','name',i->>'name','loaded',i->'loaded')) from jsonb_array_elements(q->'initial_load') i),'[]'::jsonb)) from (select private.owner_close_quote(t,r) q) v;
$$;
revoke all on function private.assistant_close_quote(uuid,uuid) from public,anon,authenticated;

create function public.assistant_preview_close(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.accepted_trip_access(p_tenant,p_trip) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Solo el asistente aceptado puede rendir su reparto activo' using errcode='42501'; end if;
 return private.assistant_close_quote(p_tenant,p_trip);
end $$;

create function public.assistant_submit_close(p_tenant uuid,p_id uuid,p_trip uuid,p_expected jsonb,p_cash numeric,p_transfer numeric,p_stock jsonb,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.assistant_trip_close_snapshots; counted jsonb; payload jsonb; q jsonb; result jsonb;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if p_id is null or p_expected is null or jsonb_typeof(p_expected)<>'object' or p_cash is null or p_transfer is null or p_cash not between 0 and 999999999999.99 or p_transfer not between 0 and 999999999999.99 or p_cash<>round(p_cash,2) or p_transfer<>round(p_transfer,2) or p_note is null or length(p_note)>400 then raise exception 'Rendicion invalida'; end if;
 counted:=private.trip_normalize_stock(p_stock);
 payload:=jsonb_build_object('expected',p_expected,'cash',p_cash,'transfer',p_transfer,'stock',counted,'note',p_note);
 select * into prior from public.assistant_trip_close_snapshots where tenant_id=p_tenant and id=p_id;
 if found then
  if prior.actor_id=auth.uid() and prior.trip_id=p_trip and prior.request=payload then
   if private.accepted_trip_access(p_tenant,p_trip) then return prior.snapshot; end if;
   -- A known command may be acknowledged after close/revocation, without reading business data.
   return jsonb_build_object('id',p_id);
  end if;
  raise exception 'ID de rendicion utilizado con otros datos';
 end if;
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;

 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no activo o ya presentado'; end if;
 if exists(select 1 from public.trip_closures where tenant_id=p_tenant and (id=p_id or (trip_id=p_trip and status in ('submitted','approved')))) or exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id=p_id) then raise exception 'Ya existe una rendicion u operacion'; end if;
 if exists(select 1 from jsonb_array_elements(counted) i where not exists(select 1 from public.products where tenant_id=p_tenant and id=(i->>'product_id')::uuid)) then raise exception 'Articulo ajeno en rendicion'; end if;
 q:=private.assistant_close_quote(p_tenant,p_trip);
 if q<>p_expected then raise exception 'El reparto cambio; actualiza el resumen y conta de nuevo'; end if;
 if (q->>'pending_visits')::integer>0 then raise exception 'Quedan clientes sin resultado; registra atencion o ausencia'; end if;
 if (q->>'equipment_count')::integer>0 then raise exception 'El jefe debe registrar el regreso de equipos identificados antes de rendir'; end if;
 if (p_cash<>(q->>'cash')::numeric or p_transfer<>(q->>'transfer')::numeric or counted<>private.trip_expected_stock(p_tenant,p_trip)) and length(trim(p_note))=0 then raise exception 'Las diferencias requieren una observacion'; end if;
 update public.inventory_trips set status='submitted',submitted_at=now() where tenant_id=p_tenant and id=p_trip;
 insert into public.trip_closures(tenant_id,id,trip_id,actor_id,expected_cash,expected_transfer,declared_cash,declared_transfer,expected_stock,declared_stock,note)
 values(p_tenant,p_id,p_trip,auth.uid(),(q->>'cash')::numeric,(q->>'transfer')::numeric,p_cash,p_transfer,private.trip_expected_stock(p_tenant,p_trip),counted,p_note);
 result:=q||jsonb_build_object('id',p_id,'submitted_at',now(),'closure_state','submitted','declared_cash',p_cash,'declared_transfer',p_transfer,'declared_stock',counted,'note',p_note,'company',(select name from public.tenants where id=p_tenant),'driver',coalesce((select full_name from public.user_profiles where user_id=auth.uid()),'Asistente'),'trip',(q->'trip')||jsonb_build_object('status','submitted'));
 insert into public.assistant_trip_close_snapshots values(p_tenant,p_id,p_trip,auth.uid(),payload,result,now());
 insert into public.owner_notifications(tenant_id,recipient_id,kind,source_id,trip_id) select p_tenant,user_id,'trip_closure',p_id,p_trip from public.tenant_members where tenant_id=p_tenant and role='owner' and active;
 return result;
end $$;

create function public.assistant_close_state(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Acceso al reparto finalizado' using errcode='42501'; end if;
 return (select s.snapshot from public.assistant_trip_close_snapshots s where s.tenant_id=p_tenant and s.trip_id=p_trip and s.actor_id=auth.uid() order by s.created_at desc,s.id limit 1);
end $$;

create function public.owner_assistant_close_inbox(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede consultar rendiciones' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(v.snapshot order by v.created_at desc,v.id) from (select s.id,s.created_at,s.snapshot from public.assistant_trip_close_snapshots s join public.trip_closures c on c.tenant_id=s.tenant_id and c.id=s.id where s.tenant_id=p_tenant order by (c.status='submitted') desc,s.created_at desc,s.id limit 50) v),'[]'::jsonb);
end $$;

-- Preserve the old administrative path for old records. New snapshot records
-- always use reconciliation below, including calls to the existing RPC name.
alter function public.trip_review_close(uuid,uuid,boolean,text) set schema private;
alter function private.trip_review_close(uuid,uuid,boolean,text) rename to legacy_trip_review_close;
revoke all on function private.legacy_trip_review_close(uuid,uuid,boolean,text) from public,anon,authenticated;
create function public.trip_review_close(p_tenant uuid,p_id uuid,p_approve boolean,p_note text default '') returns text
language plpgsql security definer set search_path='' as $$
declare c public.trip_closures; s public.assistant_trip_close_snapshots; decision text; q jsonb; expected jsonb; items jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede aprobar la rendicion' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into s from public.assistant_trip_close_snapshots where tenant_id=p_tenant and id=p_id;
 if not found then return private.legacy_trip_review_close(p_tenant,p_id,p_approve,p_note); end if;
 if p_approve is null or p_note is null or length(p_note)>400 or (not p_approve and length(trim(p_note))=0) then raise exception 'Indica una decision y observacion validas'; end if;
 select * into c from public.trip_closures where tenant_id=p_tenant and id=p_id;
 decision:=case when p_approve then 'approved' else 'observed' end;
 if c.status=decision and c.decided_by=auth.uid() and c.decision_note=p_note then return decision; end if;
 if c.status<>'submitted' or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=c.trip_id and status='submitted') then raise exception 'Rendicion ya resuelta o reparto no presentado'; end if;
 if p_approve then
  q:=private.assistant_close_quote(p_tenant,c.trip_id);
  expected:=(s.request->'expected')||jsonb_build_object('trip',(s.request->'expected'->'trip')||jsonb_build_object('status','submitted'),'pending_closure',true);
  if q<>expected then raise exception 'El reparto cambio desde la rendicion; devolvela para corregir y presentar de nuevo'; end if;
  if c.declared_cash<>(q->>'cash')::numeric or c.declared_transfer<>(q->>'transfer')::numeric or c.declared_stock<>private.trip_expected_stock(p_tenant,c.trip_id) then raise exception 'Hay diferencias; devuelve la rendicion y concilia caja o stock antes de aprobar'; end if;
 end if;
 update public.trip_closures set status=decision,decided_by=auth.uid(),decided_at=now(),decision_note=p_note where tenant_id=p_tenant and id=p_id;
 if p_approve then
  select coalesce(jsonb_agg(jsonb_build_object('product_id',i->>'product_id','quantity',(i->>'ready')::integer)),'[]'::jsonb) into items from jsonb_array_elements(c.declared_stock) i;
  perform public.inventory_post(p_tenant,p_id,'close',c.trip_id,null,items,p_note);
 else
  update public.inventory_trips set status='active',submitted_at=null where tenant_id=p_tenant and id=c.trip_id;
 end if;
 update public.assistant_trip_close_snapshots set snapshot=s.snapshot||jsonb_build_object('closure_state',decision,'decision_note',p_note,'decided_at',now(),'closed_at',case when p_approve then now() else null end,'trip',(s.snapshot->'trip')||jsonb_build_object('status',case when p_approve then 'closed' else 'active' end)) where tenant_id=p_tenant and id=p_id;
 -- Preserve the historical last GPS position; trip status controls freshness.
 return decision;
end $$;
revoke all on function public.assistant_preview_close(uuid,uuid),public.assistant_submit_close(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text),public.assistant_close_state(uuid,uuid),public.owner_assistant_close_inbox(uuid),public.trip_review_close(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.assistant_preview_close(uuid,uuid),public.assistant_submit_close(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text),public.assistant_close_state(uuid,uuid),public.owner_assistant_close_inbox(uuid),public.trip_review_close(uuid,uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
