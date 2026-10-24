begin;
-- Narrow read contract; does not enable general driver table permissions.
create or replace function public.assistant_open_trip(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 return jsonb_build_object(
 'trip',(select jsonb_build_object('name',name,'date',service_date,'status',status) from public.inventory_trips where tenant_id=p_tenant and id=p_trip),
 'stops',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'locality',c.locality,'phone',c.phone,'latitude',c.latitude,'longitude',c.longitude,'position',r.position,'outcome',r.outcome,'followup',r.followup,'next_date',r.next_date,'pending_recovery',c.pending_recovery) order by r.position,c.id)
 from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id
 where r.tenant_id=p_tenant and r.trip_id=p_trip and r.active and c.active),'[]'::jsonb),
 'stock',coalesce((select jsonb_agg(jsonb_build_object('product_id',s.product_id,'name',p.name,'unit',p.unit,'family',p.family,'returnable',p.returnable,'loaded',s.loaded,'ready',s.ready,'empties',s.empties) order by p.name,p.id)
 from (
  select m.product_id,coalesce(sum(m.truck_ready) filter(where o.kind='load'),0)::bigint loaded,sum(m.truck_ready)::bigint ready,sum(m.truck_empty)::bigint empties
  from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id
  where o.tenant_id=p_tenant and o.trip_id=p_trip group by m.product_id
 ) s join public.products p on p.tenant_id=p_tenant and p.id=s.product_id),'[]'::jsonb));
end $$;
revoke all on function public.assistant_open_trip(uuid,uuid) from public,anon;
grant execute on function public.assistant_open_trip(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
