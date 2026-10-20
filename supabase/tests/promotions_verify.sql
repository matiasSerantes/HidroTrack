begin read only;
do $$ declare signature text; target text; begin
 foreach signature in array array[
 'public.promotion_set_permission(uuid,uuid,uuid,boolean)',
 'public.promotion_offer(uuid,uuid,uuid,text,text,text,text,date,date,jsonb)',
 'public.promotion_resolve(uuid,uuid,uuid,text,date,uuid,jsonb)',
 'public.promotion_recover(uuid,uuid,uuid,date,jsonb)',
 'public.promotion_read_notification(uuid,uuid)'] loop
  if to_regprocedure(signature) is null then raise exception 'Missing %',signature; end if;
  if has_function_privilege('anon',signature,'execute') or not has_function_privilege('authenticated',signature,'execute') then raise exception 'Invalid RPC grants %',signature; end if;
 end loop;
 foreach target in array array['promotions','promotion_events','promotion_notifications'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=target and c.relrowsecurity) then raise exception 'Missing RLS %',target; end if;
  if has_table_privilege('authenticated','public.'||target,'insert') or has_table_privilege('authenticated','public.'||target,'update') or has_table_privilege('authenticated','public.'||target,'delete') then raise exception 'Direct writes enabled %',target; end if;
 end loop;
 if exists(select 1 from public.inventory_movements group by tenant_id,product_id having sum(promotion_held)<0 or sum(promotion_damaged)<0) then raise exception 'Negative promotion balance'; end if;
 if exists(select 1 from public.promotions p join public.inventory_operations o on o.tenant_id=p.tenant_id and o.promotion_id=p.id join public.inventory_movements m on m.tenant_id=o.tenant_id and m.operation_id=o.id where p.status in ('closed','converted') group by p.tenant_id,p.id,m.product_id having sum(m.promotion_held)<>0) then raise exception 'Closed promotion still holds stock'; end if;
end $$;
commit;
