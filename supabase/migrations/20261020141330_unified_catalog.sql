begin;
create function public.catalog_create_item(p_tenant uuid,p_id uuid,p_name text,p_price numeric,p_unit text,p_returnable boolean,p_family text) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.products;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede crear artículos' using errcode='42501'; end if;
 if p_family is null or p_family not in ('article','dispenser') then raise exception 'Tipo inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into existing from public.products where id=p_id;
 if found and existing.family<>p_family then raise exception 'ID de artículo ya utilizado con otro tipo'; end if;
 perform public.inventory_create_product(p_tenant,p_id,p_name,p_price,p_unit,p_returnable);
 update public.products set family=p_family where tenant_id=p_tenant and id=p_id;
 return p_id;
end $$;
create table public.catalog_archive_events (
 tenant_id uuid not null,
 id uuid not null,
 product_id uuid not null,
 actor_id uuid not null references auth.users(id),
 occurred_on date not null,
 note text not null check(length(trim(note)) between 1 and 400),
 ready_operation uuid,
 empty_operation uuid,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id),
 foreign key(tenant_id,ready_operation) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,empty_operation) references public.inventory_operations(tenant_id,id)
);
alter table public.catalog_archive_events enable row level security;
create policy catalog_archive_events_read on public.catalog_archive_events for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.catalog_archive_events from public,anon,authenticated;
grant select on public.catalog_archive_events to authenticated;
create function public.catalog_archive_item(p_tenant uuid,p_id uuid,p_product uuid,p_date date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.catalog_archive_events; ready bigint; empties bigint; truck_ready bigint; truck_empty bigint; held bigint; ready_id uuid; empty_id uuid;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede eliminar artículos' using errcode='42501'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 400 then raise exception 'Fecha o motivo inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.catalog_archive_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.product_id=p_product and previous.actor_id=auth.uid() and previous.occurred_on=p_date and previous.note=p_note then return p_product; end if;
  raise exception 'ID de eliminación ya utilizado';
 end if;
 if not exists(select 1 from public.products where tenant_id=p_tenant and id=p_product and active) then raise exception 'Artículo no habilitado'; end if;
 select coalesce(sum(depot_ready),0),coalesce(sum(depot_empty),0),coalesce(sum(m.truck_ready),0),coalesce(sum(m.truck_empty),0),coalesce(sum(customer_held),0) into ready,empties,truck_ready,truck_empty,held from public.inventory_movements m where tenant_id=p_tenant and product_id=p_product;
 if truck_ready<>0 or truck_empty<>0 or held<>0 or exists(select 1 from public.dispenser_assignments where tenant_id=p_tenant and product_id=p_product and status='active') then raise exception 'Primero recuperá las unidades de camiones y clientes'; end if;
 if ready<0 or empties<0 or ready>100000 or empties>100000 then raise exception 'Revisá las existencias antes de eliminar'; end if;
 if ready>0 then ready_id:=gen_random_uuid();perform public.inventory_remove(p_tenant,ready_id,'remove',p_product,ready::integer,'depot_ready',null,null,p_date,'owner',auth.uid(),p_note); end if;
 if empties>0 then empty_id:=gen_random_uuid();perform public.inventory_remove(p_tenant,empty_id,'remove',p_product,empties::integer,'depot_empty',null,null,p_date,'owner',auth.uid(),p_note); end if;
 update public.products set active=false where tenant_id=p_tenant and id=p_product;
 insert into public.catalog_archive_events(tenant_id,id,product_id,actor_id,occurred_on,note,ready_operation,empty_operation) values(p_tenant,p_id,p_product,auth.uid(),p_date,p_note,ready_id,empty_id);
 return p_product;
end $$;
create function public.inventory_writeoff_dispenser(p_tenant uuid,p_id uuid,p_asset uuid,p_date date,p_involved_kind text,p_involved_id uuid,p_note text,p_kind text default 'remove') returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.dispensers; previous public.dispenser_events; detail jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede retirar equipos' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('remove','damage') or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 400 then raise exception 'Fecha, tipo o motivo inválido'; end if;
 if p_involved_kind='customer' then
  if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_involved_id) then raise exception 'Cliente no válido'; end if;
 elsif p_involved_kind in ('owner','driver') then
  if not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=p_involved_id and role=p_involved_kind and active) then raise exception 'Usuario no válido'; end if;
 else raise exception 'Indicá a quién le ocurrió'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 detail:=jsonb_build_object('kind',p_kind,'involved_kind',p_involved_kind,'involved_id',p_involved_id,'note',p_note);
 select * into previous from public.dispenser_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.dispenser_id=p_asset and previous.occurred_on=p_date and previous.incident=detail then return p_asset; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 select * into a from public.dispensers where tenant_id=p_tenant and id=p_asset;
 if not found or a.retired then raise exception 'Dispenser no disponible'; end if;
 if p_kind='remove' and (a.location<>'depot' or a.ownership<>'company') then raise exception 'Primero devolvé el equipo al depósito; no se elimina una asignación'; end if;
 update public.dispensers set retired=true,updated_at=now() where tenant_id=p_tenant and id=p_asset;
 insert into public.dispenser_events(tenant_id,id,dispenser_id,actor_id,old_value,new_value,occurred_on,incident) values(p_tenant,p_id,p_asset,auth.uid(),to_jsonb(a),to_jsonb(a)||'{"retired":true}'::jsonb,p_date,detail);
 return p_asset;
end $$;
revoke all on function public.catalog_create_item(uuid,uuid,text,numeric,text,boolean,text),public.catalog_archive_item(uuid,uuid,uuid,date,text),public.inventory_writeoff_dispenser(uuid,uuid,uuid,date,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.catalog_create_item(uuid,uuid,text,numeric,text,boolean,text),public.catalog_archive_item(uuid,uuid,uuid,date,text),public.inventory_writeoff_dispenser(uuid,uuid,uuid,date,text,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
