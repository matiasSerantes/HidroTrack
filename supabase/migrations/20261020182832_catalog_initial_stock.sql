begin;
create function public.catalog_create_stocked_item(p_tenant uuid,p_id uuid,p_stock_id uuid,p_name text,p_price numeric,p_unit text,p_returnable boolean,p_family text,p_quantity integer,p_empty boolean,p_date date) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede crear artículos con stock' using errcode='42501'; end if;
 if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Cantidad inicial inválida'; end if;
 if p_stock_id is null or p_empty is null then raise exception 'Falta identificar el ingreso inicial'; end if;
 if p_empty and (p_family<>'article' or not p_returnable) then raise exception 'Solo los envases retornables ingresan vacíos'; end if;
 if p_unit is null or trim(p_unit)~'^[0-9.,]+$' then raise exception 'La unidad de venta no es la cantidad; usá unidad, cajón o pack'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 perform public.catalog_create_item(p_tenant,p_id,p_name,p_price,p_unit,p_returnable,p_family);
 perform public.inventory_record_stock(p_tenant,p_stock_id,case when p_empty then 'receive_empty' else 'receive' end,null,null,jsonb_build_array(jsonb_build_object('product_id',p_id,'quantity',p_quantity)),'Inventario inicial registrado al crear el artículo',p_date);
 return p_id;
end $$;
revoke all on function public.catalog_create_stocked_item(uuid,uuid,uuid,text,numeric,text,boolean,text,integer,boolean,date) from public,anon,authenticated;
grant execute on function public.catalog_create_stocked_item(uuid,uuid,uuid,text,numeric,text,boolean,text,integer,boolean,date) to authenticated;
notify pgrst,'reload schema';
commit;
