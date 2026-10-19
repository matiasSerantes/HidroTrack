begin;
create function private.inventory_product_archive_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.active and not new.active then
  perform 1 from public.tenants where id=old.tenant_id for update;
  if exists(select 1 from public.inventory_movements where tenant_id=old.tenant_id and product_id=old.id
   having coalesce(sum(depot_ready),0)>0 or coalesce(sum(depot_empty),0)>0 or coalesce(sum(truck_ready),0)>0 or coalesce(sum(truck_empty),0)>0 or coalesce(sum(customer_held),0)>0) then
   raise exception 'El artículo tiene unidades activas. Registrá primero las devoluciones, bajas o roturas';
  end if;
 end if;
 return new;
end $$;
create trigger inventory_product_archive_guard before update of active on public.products for each row execute function private.inventory_product_archive_guard();
revoke all on function private.inventory_product_archive_guard() from public,anon,authenticated;
commit;
