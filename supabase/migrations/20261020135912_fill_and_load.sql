begin;
create table public.inventory_load_preparations (
 tenant_id uuid not null,
 id uuid not null,
 requested_refill_id uuid not null,
 refill_operation uuid,
 trip_id uuid not null,
 actor_id uuid not null references auth.users(id),
 items jsonb not null,
 refill_items jsonb not null,
 occurred_on date not null,
 note text not null check(length(note)<=400),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 unique(tenant_id,requested_refill_id),
 foreign key(tenant_id,id) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,refill_operation) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 check(id<>requested_refill_id)
);
alter table public.inventory_load_preparations enable row level security;
create policy inventory_load_preparations_read on public.inventory_load_preparations for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.inventory_load_preparations from public,anon,authenticated;
grant select on public.inventory_load_preparations to authenticated;
create function public.inventory_fill_and_load(p_tenant uuid,p_id uuid,p_refill_id uuid,p_trip uuid,p_items jsonb,p_date date,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_load_preparations; item jsonb; product public.products; seen uuid[]:='{}'; quantity numeric; ready bigint; empties bigint; shortage bigint; refills jsonb:='[]';
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede rellenar y cargar' using errcode='42501'; end if;
 if p_id is null or p_refill_id is null or p_id=p_refill_id or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(p_note)>400 then raise exception 'Carga o fecha inválida'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Ingresá entre 1 y 200 artículos'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.inventory_load_preparations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.requested_refill_id=p_refill_id and previous.trip_id=p_trip and previous.items=p_items and previous.occurred_on=p_date and previous.note=p_note then return p_id; end if;
  raise exception 'ID de carga ya utilizado con otros datos';
 end if;
 if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id in (p_id,p_refill_id)) or exists(select 1 from public.inventory_load_preparations where tenant_id=p_tenant and requested_refill_id=p_refill_id) then raise exception 'ID de operación ya utilizado'; end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='planned') then raise exception 'Carga ya confirmada o reparto no preparado'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  quantity:=(item->>'quantity')::numeric;
  if quantity is null or quantity not between 1 and 100000 or quantity<>trunc(quantity) then raise exception 'Cantidad inválida'; end if;
  select * into product from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid and active for share;
  if not found then raise exception 'Artículo no habilitado'; end if;
  if product.id=any(seen) then raise exception 'Artículo repetido'; end if;
  seen:=array_append(seen,product.id);
  select coalesce(sum(depot_ready),0),coalesce(sum(depot_empty),0) into ready,empties from public.inventory_movements where tenant_id=p_tenant and product_id=product.id;
  shortage:=greatest(quantity-ready,0)::bigint;
  if shortage>0 then
   if not product.returnable or product.family='dispenser' then raise exception 'No se puede rellenar ese artículo; faltan unidades disponibles'; end if;
   if shortage>empties then raise exception 'No hay suficientes bidones llenos y vacíos para esta carga'; end if;
   refills:=refills||jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',shortage));
  end if;
 end loop;
 if jsonb_array_length(refills)>0 then
  perform public.inventory_record_stock(p_tenant,p_refill_id,'refill',null,null,refills,p_note,p_date);
 end if;
 perform public.inventory_record_stock(p_tenant,p_id,'load',p_trip,null,p_items,p_note,p_date);
 insert into public.inventory_load_preparations(tenant_id,id,requested_refill_id,refill_operation,trip_id,actor_id,items,refill_items,occurred_on,note)
 values(p_tenant,p_id,p_refill_id,case when jsonb_array_length(refills)>0 then p_refill_id else null end,p_trip,auth.uid(),p_items,refills,p_date,p_note);
 return p_id;
end $$;
revoke all on function public.inventory_fill_and_load(uuid,uuid,uuid,uuid,jsonb,date,text) from public,anon,authenticated;
grant execute on function public.inventory_fill_and_load(uuid,uuid,uuid,uuid,jsonb,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
