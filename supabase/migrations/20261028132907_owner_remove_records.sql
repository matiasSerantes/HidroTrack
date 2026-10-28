begin;
alter table public.inventory_trips add column removed_at timestamptz, add column removed_by uuid references auth.users(id);
alter table public.customers add column removed_at timestamptz, add column removed_by uuid references auth.users(id);
create function public.owner_remove_trip(p_tenant uuid,p_trip uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.inventory_trips;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede eliminar recorridos' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into t from public.inventory_trips where tenant_id=p_tenant and id=p_trip for update;
 if not found then raise exception 'Recorrido no encontrado'; end if;
 if t.removed_at is not null then return p_trip; end if;
 if t.status not in ('planned','closed') then raise exception 'Primero finaliza y rinde este reparto; todavia tiene una carga en curso'; end if;
 -- A cancelled, unloaded plan must cease to be actionable by legacy RPCs.
 if t.status='planned' then
  if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and trip_id=p_trip) then raise exception 'Este recorrido tiene movimientos: revisa y cierra el reparto antes de eliminarlo'; end if;
  update public.trip_invitations set state='revoked',revoked_at=now() where tenant_id=p_tenant and trip_id=p_trip and state in ('pending','accepted');
 end if;
 update public.route_stops set active=false,version=version+1,updated_at=now() where tenant_id=p_tenant and trip_id=p_trip and active;
 update public.inventory_trips set removed_at=now(),removed_by=auth.uid(),status='closed',started_at=coalesce(started_at,now()),submitted_at=coalesce(submitted_at,now()),closed_at=coalesce(closed_at,now()) where tenant_id=p_tenant and id=p_trip;
 return p_trip;
end $$;
create function public.owner_remove_customer(p_tenant uuid,p_customer uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede eliminar clientes' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 perform 1 from public.customers where tenant_id=p_tenant and id=p_customer for update;
 if not found then raise exception 'Cliente no encontrado'; end if;
 if exists(select 1 from public.route_stops s join public.inventory_trips t on t.tenant_id=s.tenant_id and t.id=s.trip_id where s.tenant_id=p_tenant and s.customer_id=p_customer and s.active and t.status in ('active','submitted')) then raise exception 'Primero retira al cliente del reparto en curso o finaliza ese reparto'; end if;
 -- Existing recovery trigger keeps outstanding containers and equipment visible.
 update public.customers set active=false,removed_at=coalesce(removed_at,now()),removed_by=coalesce(removed_by,auth.uid()) where tenant_id=p_tenant and id=p_customer;
 update public.route_stops s set active=false,version=version+1,updated_at=now() where s.tenant_id=p_tenant and s.customer_id=p_customer and s.active and exists(select 1 from public.inventory_trips t where t.tenant_id=s.tenant_id and t.id=s.trip_id and t.status='planned');
 return p_customer;
end $$;
revoke all on function public.owner_remove_trip(uuid,uuid),public.owner_remove_customer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.owner_remove_trip(uuid,uuid),public.owner_remove_customer(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
