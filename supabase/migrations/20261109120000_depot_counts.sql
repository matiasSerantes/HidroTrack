create table private.inventory_depot_count_corrections (
 tenant_id uuid not null references public.tenants(id),
 id uuid not null,
 actor_id uuid not null references auth.users(id),
 request jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id)
);
alter table private.inventory_depot_count_corrections enable row level security;
revoke all on private.inventory_depot_count_corrections from public,anon,authenticated;

create function private.inventory_set_depot_counts(p_tenant uuid,p_id uuid,p_product uuid,p_expected_ready bigint,p_expected_empty bigint,p_ready bigint,p_empty bigint,p_date date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous private.inventory_depot_count_corrections; payload jsonb; current_ready bigint; current_empty bigint; delta_ready bigint; delta_empty bigint; p public.products;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede corregir el depósito' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('product',p_product,'expected_ready',p_expected_ready,'expected_empty',p_expected_empty,'ready',p_ready,'empty',p_empty,'date',p_date,'note',p_note);
 select * into previous from private.inventory_depot_count_corrections where tenant_id=p_tenant and id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return p_id; end if; raise exception 'ID de conteo utilizado con otros datos'; end if;
 if p_id is null or p_product is null or p_expected_ready is null or p_expected_empty is null or p_expected_ready<0 or p_expected_empty<0 or p_ready is null or p_empty is null or p_ready<0 or p_empty<0 or p_ready>1000000000 or p_empty>1000000000 or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 360 then raise exception 'Revisá cantidades, fecha y motivo'; end if;
 select * into p from public.products where tenant_id=p_tenant and id=p_product and active for share;
 if not found or (p_empty>0 and (not p.returnable or p.family='dispenser')) then raise exception 'Estado no disponible para este producto'; end if;
 select coalesce(sum(depot_ready),0),coalesce(sum(depot_empty),0) into current_ready,current_empty from public.inventory_movements where tenant_id=p_tenant and product_id=p_product;
 if current_ready<>p_expected_ready or current_empty<>p_expected_empty then raise exception 'El depósito cambió. Actualizá antes de guardar el conteo'; end if;
 delta_ready:=p_ready-current_ready;delta_empty:=p_empty-current_empty;
 if (delta_ready=0 and delta_empty=0) or abs(delta_ready)>100000 or abs(delta_empty)>100000 then raise exception 'Indicá un cambio de hasta 100000 unidades por estado'; end if;
 if delta_ready>0 then perform public.inventory_record_stock(p_tenant,gen_random_uuid(),'receive',null,null,jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',delta_ready)),'Conteo de llenos: '||p_note,p_date);
 elsif delta_ready<0 then perform public.inventory_remove(p_tenant,gen_random_uuid(),'remove',p_product,(-delta_ready)::integer,'depot_ready',null,null,p_date,'owner',auth.uid(),'Conteo de llenos: '||p_note); end if;
 if delta_empty>0 then perform public.inventory_record_stock(p_tenant,gen_random_uuid(),'receive_empty',null,null,jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',delta_empty)),'Conteo de vacíos: '||p_note,p_date);
 elsif delta_empty<0 then perform public.inventory_remove(p_tenant,gen_random_uuid(),'remove',p_product,(-delta_empty)::integer,'depot_empty',null,null,p_date,'owner',auth.uid(),'Conteo de vacíos: '||p_note); end if;
 insert into private.inventory_depot_count_corrections(tenant_id,id,actor_id,request) values(p_tenant,p_id,auth.uid(),payload);
 return p_id;
end $$;
revoke all on function private.inventory_set_depot_counts(uuid,uuid,uuid,bigint,bigint,bigint,bigint,date,text) from public,anon,authenticated;
grant execute on function private.inventory_set_depot_counts(uuid,uuid,uuid,bigint,bigint,bigint,bigint,date,text) to authenticated;
create function public.inventory_set_depot_counts(p_tenant uuid,p_id uuid,p_product uuid,p_expected_ready bigint,p_expected_empty bigint,p_ready bigint,p_empty bigint,p_date date,p_note text) returns uuid
language sql security invoker set search_path='' as $$select private.inventory_set_depot_counts(p_tenant,p_id,p_product,p_expected_ready,p_expected_empty,p_ready,p_empty,p_date,p_note)$$;
revoke all on function public.inventory_set_depot_counts(uuid,uuid,uuid,bigint,bigint,bigint,bigint,date,text) from public,anon;
grant execute on function public.inventory_set_depot_counts(uuid,uuid,uuid,bigint,bigint,bigint,bigint,date,text) to authenticated;
