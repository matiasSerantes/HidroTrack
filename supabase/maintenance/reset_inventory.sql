-- One-off reset explicitly requested by the owner. Not a schema migration or public RPC.
-- First verify the target tenant through authenticated MCP. In the SAME transaction:
-- select set_config('hidrotrack.reset_tenant', '<VERIFIED_TENANT_UUID>', true);
-- Then execute this block, verify inventory is empty and account/customers unchanged, commit.
-- Never infer the tenant from its name or apply to every tenant.
do $$
declare target uuid; customer_count bigint;
begin
 target:=nullif(current_setting('hidrotrack.reset_tenant',true),'')::uuid;
 if target is null then raise exception 'Falta empresa destino verificada'; end if;
 perform 1 from public.tenants where id=target for update;
 if not found then raise exception 'Empresa destino inexistente'; end if;
 if exists(select 1 from public.inventory_trips where tenant_id=target and status in ('active','submitted')) then raise exception 'Hay repartos activos o pendientes de rendición; no se reinició el inventario'; end if;
 select count(*) into customer_count from public.customers where tenant_id=target;
 -- Optional table: the model-assignment migration may still be pending remotely.
 if to_regclass('public.dispenser_assignments') is not null then
  execute 'delete from public.dispenser_assignments where tenant_id=$1' using target;
 end if;
 delete from public.dispenser_events where tenant_id=target;
 delete from public.dispensers where tenant_id=target;
 delete from public.inventory_movements where tenant_id=target;
 delete from public.inventory_operations where tenant_id=target;
 delete from public.customer_product_preferences where tenant_id=target;
 delete from public.products where tenant_id=target;
 if (select count(*) from public.customers where tenant_id=target)<>customer_count then raise exception 'El conteo de clientes cambió; se revierte la limpieza'; end if;
 if exists(select 1 from public.products where tenant_id=target)
 or exists(select 1 from public.inventory_operations where tenant_id=target)
 or exists(select 1 from public.inventory_movements where tenant_id=target)
 or exists(select 1 from public.dispensers where tenant_id=target) then raise exception 'Inventario no quedó vacío; se revierte la limpieza'; end if;
end $$;
