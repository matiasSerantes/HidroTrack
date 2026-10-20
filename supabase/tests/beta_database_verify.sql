-- Read-only verification of installed contracts. No personal data is returned.
begin read only;
do $$
declare signature text; table_name text;
begin
 foreach signature in array array[
 'public.commerce_deliver(uuid,uuid,uuid,uuid,jsonb,numeric,text,text)',
 'public.commerce_record_payment(uuid,uuid,uuid,numeric,text,date,uuid,text)',
 'public.commerce_review_credit(uuid,uuid,boolean,text)',
 'public.commerce_read_notification(uuid,uuid)',
 'public.route_edit_stop(uuid,uuid,uuid,uuid,integer,boolean,integer)',
 'public.route_record_visit(uuid,uuid,uuid,uuid,text,integer,text,date,text)',
 'public.route_publish_position(uuid,uuid,double precision,double precision,double precision)',
 'public.route_stop_position(uuid)',
 'public.route_manifest(uuid,uuid)',
 'public.customer_request_deactivation(uuid,uuid,uuid,text)',
 'public.customer_review_deactivation(uuid,uuid,boolean,text)',
 'public.trip_submit_close(uuid,uuid,uuid,numeric,numeric,jsonb,text)',
 'public.trip_review_close(uuid,uuid,boolean,text)',
 'public.admin_set_driver_access(uuid,uuid,boolean)',
 'public.admin_access_history()'
 ,'public.commerce_charge_rental(uuid,uuid,uuid,uuid,integer,date)'
 ,'public.commerce_open_customer_balance(uuid,uuid,uuid,numeric,date,text)'
 ,'public.inventory_fill_and_load(uuid,uuid,uuid,uuid,jsonb,date,text)'
 ,'public.catalog_create_item(uuid,uuid,text,numeric,text,boolean,text)'
 ,'public.catalog_archive_item(uuid,uuid,uuid,date,text)'
 ,'public.inventory_writeoff_dispenser(uuid,uuid,uuid,date,text,uuid,text,text)'
 ] loop
  if to_regprocedure(signature) is null then raise exception 'Falta RPC: %',signature; end if;
  if has_function_privilege('anon',signature,'EXECUTE') or not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Permisos RPC incorrectos: %',signature; end if;
  if not exists(select 1 from pg_proc where oid=to_regprocedure(signature) and prosecdef and array_to_string(proconfig,',') like '%search_path=%') then raise exception 'RPC sin configuración segura: %',signature; end if;
 end loop;
 foreach table_name in array array['sales','sale_items','payments','credit_requests','owner_notifications','route_stops','route_events','driver_positions','customer_deactivations','trip_closures','rental_charges','inventory_load_preparations','catalog_archive_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then raise exception 'Falta RLS: %',table_name; end if;
  if has_table_privilege('authenticated','public.'||table_name,'INSERT') or has_table_privilege('authenticated','public.'||table_name,'UPDATE') or has_table_privilege('authenticated','public.'||table_name,'DELETE') then raise exception 'Escritura directa indebida: %',table_name; end if;
 end loop;
 if has_function_privilege('authenticated','private.inventory_post_core(uuid,uuid,text,uuid,uuid,jsonb,text)','EXECUTE') then raise exception 'Núcleo de stock expuesto'; end if;
 if exists(select 1 from public.sales s where s.kind='delivery' and s.total<>(select coalesce(sum(quantity*unit_price),0) from public.sale_items i where i.tenant_id=s.tenant_id and i.sale_id=s.id)) then raise exception 'Venta sin detalle consistente'; end if;
 if exists(select 1 from public.sales s left join public.rental_charges r on r.tenant_id=s.tenant_id and r.sale_id=s.id where s.kind='rental' and (r.sale_id is null or r.monthly<>s.total)) then raise exception 'Cuota sin detalle consistente'; end if;
 if exists(select 1 from public.sales s where s.total<(select coalesce(sum(amount),0) from public.payments p where p.tenant_id=s.tenant_id and p.sale_id=s.id)) then raise exception 'Venta con sobrepago'; end if;
 if exists(select 1 from public.sales s join public.inventory_operations o on o.tenant_id=s.tenant_id and o.id=s.id where o.kind<>'delivery' or s.customer_id<>o.customer_id or s.trip_id<>o.trip_id) then raise exception 'Venta no coincide con entrega'; end if;
 if exists(select 1 from public.customers c where c.pending_recovery and not exists(select 1 from public.customer_deactivations r where r.tenant_id=c.tenant_id and r.customer_id=c.id and r.status='pending')) then raise exception 'Futura baja sin solicitud'; end if;
 if exists(select 1 from public.trip_closures c join public.inventory_trips t on t.tenant_id=c.tenant_id and t.id=c.trip_id where c.status='approved' and t.status<>'closed') then raise exception 'Rendición aprobada sin cierre'; end if;
 if not exists(select 1 from pg_trigger where tgname='trip_close_guard' and not tgisinternal and tgenabled<>'D') or not exists(select 1 from pg_trigger where tgname='customer_recovery_guard' and not tgisinternal and tgenabled<>'D') then raise exception 'Faltan guardas de proceso'; end if;
end $$;
rollback;
