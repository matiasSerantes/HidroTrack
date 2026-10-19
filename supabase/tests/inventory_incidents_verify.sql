-- Read-only post-migration verification. No customer data is returned.
begin read only;
do $$
declare signature text; protected text[]:=array[
 'public.inventory_record_stock(uuid,uuid,text,uuid,uuid,jsonb,text,date)',
 'public.inventory_remove(uuid,uuid,text,uuid,integer,text,uuid,uuid,date,text,uuid,text)',
 'public.inventory_retire_dispenser(uuid,uuid,uuid,date,text,uuid,text)',
 'public.inventory_assign_dispenser_model(uuid,uuid,uuid,uuid,text,numeric,date,uuid)',
 'public.inventory_return_dispenser_model(uuid,uuid,uuid,date)'];
begin
 foreach signature in array protected loop
  if to_regprocedure(signature) is null then raise exception 'Falta función de inventario: %',signature; end if;
  if has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Permiso anónimo incorrecto: %',signature; end if;
  if not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Falta permiso autenticado: %',signature; end if;
  if not exists(select 1 from pg_proc where oid=to_regprocedure(signature) and prosecdef and array_to_string(proconfig,',') like '%search_path=%') then raise exception 'Configuración de función incorrecta: %',signature; end if;
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='family')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory_operations' and column_name='occurred_on')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dispensers' and column_name='retired') then raise exception 'Esquema de incidentes incompleto'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('products','inventory_operations','inventory_movements','dispensers','dispenser_events') and not c.relrowsecurity) then raise exception 'RLS deshabilitado'; end if;
 if has_table_privilege('authenticated','public.inventory_movements','INSERT')
 or has_table_privilege('authenticated','public.inventory_operations','UPDATE')
 or has_table_privilege('authenticated','public.dispensers','UPDATE')
 or has_table_privilege('authenticated','public.dispenser_assignments','UPDATE') then raise exception 'El libro o equipos admiten escritura directa'; end if;
 if exists(select 1 from public.inventory_movements group by tenant_id,product_id having sum(depot_ready)<0 or sum(depot_empty)<0) then raise exception 'Saldo negativo en depósito'; end if;
 if exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where o.trip_id is not null group by m.tenant_id,o.trip_id,m.product_id having sum(m.truck_ready)<0 or sum(m.truck_empty)<0) then raise exception 'Saldo negativo en camión'; end if;
 if exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where o.customer_id is not null group by m.tenant_id,o.customer_id,m.product_id having sum(m.customer_held)<0) then raise exception 'Saldo negativo en clientes'; end if;
 if exists(select 1 from public.inventory_operations where kind in ('damage','remove') and (involved_kind is null or involved_id is null or source is null or length(trim(note))=0)) then raise exception 'Incidente sin atribución o motivo'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='dispenser_assignments' and c.relrowsecurity) then raise exception 'Asignaciones sin RLS'; end if;
 if exists(select 1 from public.dispenser_assignments a where a.status='active' group by a.tenant_id,a.product_id,a.customer_id having count(*)>(select coalesce(sum(m.customer_held),0) from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=a.tenant_id and m.product_id=a.product_id and o.customer_id=a.customer_id)) then raise exception 'Asignaciones activas superiores a las unidades en clientes'; end if;
end $$;
rollback;
