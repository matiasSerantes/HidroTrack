begin;
create table private.recycle_bin_config(id boolean primary key default true check(id),enabled boolean not null default false);
insert into private.recycle_bin_config(id) values(true);
revoke all on private.recycle_bin_config from public,anon,authenticated;
create function private.purge_recycle_bin() returns integer
language plpgsql security definer set search_path='' as $$
declare candidate record;item private.recycle_bin;purged integer:=0;locked_tenant uuid;
begin
 if not exists(select 1 from private.recycle_bin_config where enabled) then return 0; end if;
 for candidate in select id,tenant_id from private.recycle_bin where state='deleted' and expires_at<=now() order by expires_at,id limit 50 loop
  locked_tenant:=null;
  select id into locked_tenant from public.tenants where id=candidate.tenant_id for update skip locked;
  if locked_tenant is null then continue; end if;
  select * into item from private.recycle_bin where id=candidate.id and state='deleted' and expires_at<=now() for update;
  if not found then continue; end if;
  if item.kind='customer' then
   -- Prefer physical deletion if nothing references the customer. Otherwise
   -- retain an anonymous key so the existing accounting/stock ledger stays intact.
   if not exists(select 1 from public.customers where tenant_id=item.tenant_id and id=item.entity_id and removed_at is not null and not active) then continue; end if;
   begin
    delete from public.customers where tenant_id=item.tenant_id and id=item.entity_id;
   exception when foreign_key_violation then
    update public.customers set name='Cliente eliminado',address='Eliminada',phone='',locality='',street='',street_number=null,latitude=null,longitude=null
     where tenant_id=item.tenant_id and id=item.entity_id;
   end;
  else
   if not exists(select 1 from public.inventory_trips where tenant_id=item.tenant_id and id=item.entity_id and removed_at is not null and status='closed') then continue; end if;
   begin
    delete from public.inventory_trips where tenant_id=item.tenant_id and id=item.entity_id;
   exception when foreign_key_violation then
    update public.inventory_trips set name='Recorrido eliminado' where tenant_id=item.tenant_id and id=item.entity_id;
   end;
  end if;
  update private.recycle_bin set state='purged',payload=null,label='Eliminado',purged_at=now() where id=item.id;
  purged:=purged+1;
 end loop;
 return purged;
end $$;
revoke all on function private.purge_recycle_bin() from public,anon,authenticated;
-- Database-owned scheduler, no HTTP key or external data transport.
do $$ begin
 if to_regnamespace('cron') is not null then
  perform cron.schedule('hidrotrack-recycle-bin-expiry','*/10 * * * *','select private.purge_recycle_bin();');
 end if;
end $$;
commit;
