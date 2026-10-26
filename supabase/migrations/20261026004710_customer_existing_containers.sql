begin;
-- Initial allocation of already counted bottles. Historical additive openings remain unchanged.
create function public.inventory_assign_existing_containers(p_tenant uuid,p_id uuid,p_customer uuid,p_items jsonb,p_source text,p_date date,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_operations; item jsonb; available bigint; result uuid;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede asignar envases existentes' using errcode='42501'; end if;
 if p_source is null or p_source not in ('depot_ready','depot_empty') or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(p_note)>400 then raise exception 'Origen, fecha o referencia invalidos'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.kind='opening_customer' and previous.actor_id=auth.uid() and previous.source=p_source and previous.occurred_on=p_date and previous.customer_id=p_customer and previous.items=p_items and previous.note=p_note then return p_id; end if;
  raise exception 'ID de asignacion utilizado con otros datos';
 end if;
 -- Existing opening validation also checks customer, active returnable products,
 -- integer quantities, duplicate lines, and prevents a second initial allocation.
 result:=public.inventory_owner_stock(p_tenant,p_id,'opening_customer',p_customer,p_items,p_note);
 for item in select value from jsonb_array_elements(p_items) loop
  select coalesce(sum(case when p_source='depot_ready' then depot_ready else depot_empty end),0) into available from public.inventory_movements where tenant_id=p_tenant and product_id=(item->>'product_id')::uuid;
  if available<(item->>'quantity')::numeric then raise exception 'No hay suficientes envases disponibles en el origen elegido'; end if;
  update public.inventory_movements set depot_ready=case when p_source='depot_ready' then -(item->>'quantity')::integer else 0 end,depot_empty=case when p_source='depot_empty' then -(item->>'quantity')::integer else 0 end where tenant_id=p_tenant and operation_id=p_id and product_id=(item->>'product_id')::uuid;
 end loop;
 update public.inventory_operations set source=p_source,occurred_on=p_date where tenant_id=p_tenant and id=p_id;
 return result;
end $$;
revoke all on function public.inventory_assign_existing_containers(uuid,uuid,uuid,jsonb,text,date,text) from public,anon,authenticated;
grant execute on function public.inventory_assign_existing_containers(uuid,uuid,uuid,jsonb,text,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
