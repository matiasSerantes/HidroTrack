begin;
-- Append a compensating movement, never rewrite a past delivery/opening.
create function public.inventory_correct_customer_containers(p_tenant uuid,p_id uuid,p_customer uuid,p_product uuid,p_expected integer,p_quantity integer,p_source text,p_date date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_operations; product public.products; held bigint; available bigint; delta integer; lines jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede corregir envases' using errcode='42501'; end if;
 if p_id is null or p_expected is null or p_quantity is null or p_expected not between 0 and 100000 or p_quantity not between 0 and 100000 or p_source is null or p_source not in ('depot_empty','depot_ready') or p_date is null or not isfinite(p_date) or p_date<date '1900-01-01' or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 400 then raise exception 'Cantidad, origen, fecha o motivo invalidos'; end if;
 delta:=p_quantity-p_expected;
 lines:=jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',delta,'expected',p_expected,'target',p_quantity,'correction',true));
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.kind='opening_customer' and previous.actor_id=auth.uid() and previous.customer_id=p_customer and previous.items=lines and previous.source=p_source and previous.occurred_on=p_date and previous.note=p_note then return p_id; end if;
  raise exception 'ID de correccion utilizado con otros datos';
 end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and removed_at is null) then raise exception 'Cliente no disponible'; end if;
 if delta>0 and exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and (not active or pending_recovery)) then raise exception 'Cliente en baja o pendiente de recuperacion: solo se pueden reducir envases'; end if;
 select * into product from public.products where tenant_id=p_tenant and id=p_product;
 if not found or not product.returnable or product.family='dispenser' or (delta>0 and not product.active) then raise exception 'Articulo retornable no habilitado'; end if;
 select coalesce(sum(m.customer_held),0) into held from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p_product and o.customer_id=p_customer;
 if held<>p_expected then raise exception 'La cantidad del cliente cambio. Actualiza la ficha antes de corregir'; end if;
 if delta=0 then raise exception 'La cantidad no cambio'; end if;
 select coalesce(sum(case when p_source='depot_ready' then depot_ready else depot_empty end),0) into available from public.inventory_movements where tenant_id=p_tenant and product_id=p_product;
 if delta>available then raise exception 'No hay suficientes envases en el deposito elegido'; end if;
 insert into public.inventory_operations(tenant_id,id,kind,customer_id,actor_id,items,note,source,occurred_on) values(p_tenant,p_id,'opening_customer',p_customer,auth.uid(),lines,p_note,p_source,p_date);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,customer_held,unit_price) values(p_tenant,p_id,p_product,case when p_source='depot_ready' then -delta else 0 end,case when p_source='depot_empty' then -delta else 0 end,delta,product.price);
 return p_id;
end $$;
revoke all on function public.inventory_correct_customer_containers(uuid,uuid,uuid,uuid,integer,integer,text,date,text) from public,anon,authenticated;
grant execute on function public.inventory_correct_customer_containers(uuid,uuid,uuid,uuid,integer,integer,text,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
