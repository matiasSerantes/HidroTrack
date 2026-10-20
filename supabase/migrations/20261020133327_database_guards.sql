begin;
-- Prevent the old customer edit/archive path from bypassing physical recovery.
create or replace function private.customer_pending_archive_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=old.tenant_id for update;
 if old.pending_recovery and exists(select 1 from public.customer_deactivations where tenant_id=old.tenant_id and customer_id=old.id and status='pending') then
  if not new.active or not new.pending_recovery then raise exception 'Resolver la futura baja desde su solicitud'; end if;
 end if;
 if old.active and not new.active and (
  exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=old.tenant_id and o.customer_id=old.id group by m.product_id having sum(m.customer_held)>0)
  or exists(select 1 from public.dispensers where tenant_id=old.tenant_id and customer_id=old.id and ownership='company' and not retired)
  or exists(select 1 from public.dispenser_assignments where tenant_id=old.tenant_id and customer_id=old.id and status='active')
 ) then raise exception 'Futura baja: primero recuperar bidones y dispenser'; end if;
 return new;
end $$;
-- Keep model equipment in its assignment/return ledger rather than selling it
-- through a water-delivery RPC that cannot create an equipment assignment.
create function private.delivery_dispenser_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='delivery' and exists(select 1 from jsonb_array_elements(new.items) i join public.products p on p.tenant_id=new.tenant_id and p.id=(i->>'product_id')::uuid where p.family='dispenser' and (i->>'quantity')::numeric>0) then raise exception 'Asigná el dispenser desde sus equipos disponibles'; end if;
 return new;
end $$;
create trigger delivery_dispenser_guard before insert on public.inventory_operations for each row execute function private.delivery_dispenser_guard();
revoke all on function private.delivery_dispenser_guard() from public,anon,authenticated;
create view public.fleet_last_positions with(security_invoker=true) as
 select p.*,t.status as trip_status,
 (t.status='active' and p.updated_at>=now()-interval '2 minutes') as recent
 from public.driver_positions p join public.inventory_trips t on t.tenant_id=p.tenant_id and t.id=p.trip_id;
revoke all on public.fleet_last_positions from public,anon,authenticated;
grant select on public.fleet_last_positions to authenticated;
notify pgrst,'reload schema';
commit;
