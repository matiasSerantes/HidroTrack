begin;
alter table public.inventory_operations drop constraint inventory_operations_kind_check;
alter table public.inventory_operations add constraint inventory_operations_kind_check check(kind in ('receive','load','delivery','close','receive_empty','refill','opening_customer'));
alter table public.inventory_operations drop constraint inventory_operations_check;
alter table public.inventory_operations drop constraint inventory_operations_check1;
alter table public.inventory_operations add constraint inventory_operation_items check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 0 and 200 and (kind='close' or jsonb_array_length(items)>0));
alter table public.inventory_operations add constraint inventory_operation_scope check(
 (kind in ('receive','receive_empty','refill') and trip_id is null and customer_id is null)
 or (kind in ('load','close') and trip_id is not null and customer_id is null)
 or (kind='delivery' and trip_id is not null and customer_id is not null)
 or (kind='opening_customer' and trip_id is null and customer_id is not null));
alter table public.inventory_operations add foreign key(tenant_id,customer_id) references public.customers(tenant_id,id);
create index inventory_operations_client on public.inventory_operations(tenant_id,customer_id);
alter table public.inventory_movements drop constraint inventory_movements_check;
alter table public.inventory_movements add constraint inventory_movements_check check(depot_ready<>0 or truck_ready<>0 or depot_empty<>0 or truck_empty<>0 or customer_held<>0);

-- Aperturas agregan unidades físicas conocidas; rellenar NO compra otro envase.
create function public.inventory_owner_stock(p_tenant uuid,p_id uuid,p_kind text,p_customer uuid,p_items jsonb,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_operations; item jsonb; product uuid; q numeric; p public.products; available bigint; seen uuid[]='{}';
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede administrar el inventario' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if p_kind is null or p_kind not in ('receive_empty','refill','opening_customer') then raise exception 'Operación de patrimonio inválida'; end if;
 if p_kind='opening_customer' then
  if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no habilitado'; end if;
 elsif p_customer is not null then raise exception 'Esta operación es del depósito'; end if;
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.kind=p_kind and previous.actor_id=auth.uid() and previous.customer_id is not distinct from p_customer and previous.items=p_items and previous.note=p_note then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Artículos inválidos'; end if;
 if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Ingresá entre 1 y 200 artículos'; end if;
 insert into public.inventory_operations(tenant_id,id,kind,customer_id,actor_id,items,note) values(p_tenant,p_id,p_kind,p_customer,auth.uid(),p_items,p_note);
 for item in select value from jsonb_array_elements(p_items) loop
  product:=(item->>'product_id')::uuid; q:=(item->>'quantity')::numeric;
  if q is null or q<=0 or q>100000 or q<>trunc(q) then raise exception 'Usá cantidades enteras entre 1 y 100000'; end if;
  if product=any(seen) then raise exception 'Artículo repetido'; end if;
  seen:=array_append(seen,product);
  select * into p from public.products where tenant_id=p_tenant and id=product for share;
  if not found or not p.active or not p.returnable then raise exception 'Artículo retornable no habilitado'; end if;
  if p_kind='refill' then
   select coalesce(sum(depot_empty),0) into available from public.inventory_movements where tenant_id=p_tenant and product_id=product;
   if q>available then raise exception 'No hay suficientes envases vacíos para rellenar'; end if;
  end if;
  if p_kind='opening_customer' and exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=product and o.customer_id=p_customer and o.id<>p_id) then raise exception 'Ese cliente/artículo ya tiene movimientos; no se puede repetir la apertura'; end if;
  insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,customer_held,unit_price)
  values(p_tenant,p_id,product,case when p_kind='refill' then q else 0 end,case p_kind when 'receive_empty' then q when 'refill' then -q else 0 end,case when p_kind='opening_customer' then q else 0 end,p.price);
 end loop;
 return p_id;
end $$;

create view public.inventory_owned_stock with(security_invoker=true) as
 select tenant_id,product_id,sum(depot_ready)::bigint as depot_ready,sum(depot_empty)::bigint as depot_empty,
 sum(truck_ready)::bigint as truck_ready,sum(truck_empty)::bigint as truck_empty,
 sum(customer_held)::bigint as in_customers,
 sum(depot_ready+depot_empty+truck_ready+truck_empty+customer_held)::bigint as total_owned
 from public.inventory_movements where private.has_role(tenant_id,array['owner']) group by tenant_id,product_id;

create table public.dispensers (
 tenant_id uuid not null references public.tenants(id),
 id uuid not null,
 name text not null check(length(trim(name)) between 1 and 100),
 serial text not null default '' check(length(serial)<=80),
 ownership text not null check(ownership in ('company','customer')),
 location text not null check(location in ('depot','truck','customer')),
 trip_id uuid,
 customer_id uuid,
 mode text check(mode in ('loan','rental','customer_owned')),
 monthly numeric(14,2) not null default 0 check(monthly>=0),
 updated_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 check((location='depot' and trip_id is null and customer_id is null) or (location='truck' and trip_id is not null and customer_id is null) or (location='customer' and trip_id is null and customer_id is not null)),
 check((ownership='customer' and location='customer' and mode is not null and mode='customer_owned' and monthly=0)
 or (ownership='company' and location in ('depot','truck') and mode is null and monthly=0)
 or (ownership='company' and location='customer' and mode is not null and ((mode='loan' and monthly=0) or (mode='rental' and monthly>0))))
);
create unique index dispensers_serial on public.dispensers(tenant_id,serial) where serial<>'';
create index dispensers_customer on public.dispensers(tenant_id,customer_id);
create index dispensers_trip on public.dispensers(tenant_id,trip_id);
create table public.dispenser_events (
 tenant_id uuid not null,
 id uuid not null,
 dispenser_id uuid not null,
 actor_id uuid not null,
 old_value jsonb,
 new_value jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,dispenser_id) references public.dispensers(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.tenant_members(tenant_id,user_id)
);
create index dispenser_events_asset on public.dispenser_events(tenant_id,dispenser_id);
create index dispenser_events_actor on public.dispenser_events(tenant_id,actor_id);
alter table public.dispensers enable row level security;
alter table public.dispenser_events enable row level security;
create policy dispensers_owner on public.dispensers for select to authenticated using(private.has_role(tenant_id,array['owner']));
create policy dispenser_events_owner on public.dispenser_events for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.dispensers,public.dispenser_events,public.inventory_owned_stock from public,anon,authenticated;
grant select on public.dispensers,public.dispenser_events,public.inventory_owned_stock to authenticated;

create function public.inventory_save_dispenser(p_tenant uuid,p_operation uuid,p_id uuid,p_name text,p_serial text,p_ownership text,p_location text,p_customer uuid,p_trip uuid,p_mode text,p_monthly numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.dispenser_events; old_asset public.dispensers; payload jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede administrar surtidores' using errcode='42501'; end if;
 if p_monthly is null or p_monthly<0 or p_monthly>999999999999.99 or p_monthly<>round(p_monthly,2) then raise exception 'Importe inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('id',p_id,'name',p_name,'serial',p_serial,'ownership',p_ownership,'location',p_location,'customer_id',p_customer,'trip_id',p_trip,'mode',p_mode,'monthly',p_monthly);
 select * into previous from public.dispenser_events where tenant_id=p_tenant and id=p_operation;
 if found then
  if previous.actor_id=auth.uid() and previous.new_value=payload then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 if p_customer is not null and not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no habilitado'; end if;
 if p_trip is not null and not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Camión sin reparto activo'; end if;
 select * into old_asset from public.dispensers where tenant_id=p_tenant and id=p_id;
 if found and old_asset.ownership<>p_ownership then raise exception 'La propiedad del surtidor no se cambia con un traslado'; end if;
 insert into public.dispensers(tenant_id,id,name,serial,ownership,location,customer_id,trip_id,mode,monthly)
 values(p_tenant,p_id,p_name,p_serial,p_ownership,p_location,p_customer,p_trip,p_mode,p_monthly)
 on conflict(tenant_id,id) do update set name=excluded.name,serial=excluded.serial,location=excluded.location,customer_id=excluded.customer_id,trip_id=excluded.trip_id,mode=excluded.mode,monthly=excluded.monthly,updated_at=now();
 insert into public.dispenser_events(tenant_id,id,dispenser_id,actor_id,old_value,new_value) values(p_tenant,p_operation,p_id,auth.uid(),case when old_asset.id is null then null else to_jsonb(old_asset) end,payload);
 return p_id;
end $$;

create function public.inventory_create_product(p_tenant uuid,p_id uuid,p_name text,p_price numeric,p_unit text,p_returnable boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.products;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede crear artículos' using errcode='42501'; end if;
 if p_price is null or p_price<0 or p_price>999999999999.99 or p_price<>round(p_price,2) then raise exception 'Precio inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into p from public.products where id=p_id;
 if found then
  if p.tenant_id=p_tenant and p.name=p_name and p.price=p_price and p.unit=p_unit and p.returnable=p_returnable then return p_id; end if;
  raise exception 'ID de artículo ya utilizado';
 end if;
 insert into public.products(id,tenant_id,name,price,unit,returnable) values(p_id,p_tenant,p_name,p_price,p_unit,p_returnable);
 return p_id;
end $$;
revoke all on function public.inventory_owner_stock(uuid,uuid,text,uuid,jsonb,text),public.inventory_save_dispenser(uuid,uuid,uuid,text,text,text,text,uuid,uuid,text,numeric),public.inventory_create_product(uuid,uuid,text,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.inventory_owner_stock(uuid,uuid,text,uuid,jsonb,text),public.inventory_save_dispenser(uuid,uuid,uuid,text,text,text,text,uuid,uuid,text,numeric),public.inventory_create_product(uuid,uuid,text,numeric,text,boolean) to authenticated;
commit;
