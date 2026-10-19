-- Stock inicial: una unidad de catálogo es una unidad indivisible de carga.
-- Un cajón y un sifón son artículos distintos; no hay conversión automática.
begin;
alter table public.products
 add column unit text not null default 'unidad' check(length(trim(unit)) between 1 and 40),
 add column kind text not null default 'sale' check(kind in ('sale','rental')),
 add column returnable boolean not null default false;

create table public.inventory_trips (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 driver_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 100),
 service_date date not null,
 status text not null default 'planned' check(status in ('planned','active','submitted','closed')),
 started_at timestamptz,
 submitted_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,driver_id) references public.tenant_members(tenant_id,user_id),
 check ((status='planned' and started_at is null and submitted_at is null and closed_at is null)
 or (status='active' and started_at is not null and submitted_at is null and closed_at is null)
 or (status='submitted' and started_at is not null and submitted_at is not null and closed_at is null)
 or (status='closed' and started_at is not null and submitted_at is not null and closed_at is not null))
);
create unique index inventory_one_open_trip on public.inventory_trips(tenant_id,driver_id) where status in ('active','submitted');
create index inventory_driver on public.inventory_trips(tenant_id,driver_id);
create table public.inventory_trip_customers (
 tenant_id uuid not null,
 trip_id uuid not null,
 customer_id uuid not null,
 primary key(tenant_id,trip_id,customer_id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id)
);
create index inventory_customer on public.inventory_trip_customers(tenant_id,customer_id);
create table public.inventory_operations (
 tenant_id uuid not null references public.tenants(id),
 id uuid not null,
 kind text not null check(kind in ('receive','load','delivery','close')),
 trip_id uuid,
 customer_id uuid,
 actor_id uuid not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 0 and 200 and (kind='close' or jsonb_array_length(items)>0)),
 note text not null default '' check(length(note)<=400),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.tenant_members(tenant_id,user_id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 foreign key(tenant_id,trip_id,customer_id) references public.inventory_trip_customers(tenant_id,trip_id,customer_id),
 check ((kind='receive' and trip_id is null and customer_id is null)
 or (kind in ('load','close') and trip_id is not null and customer_id is null)
 or (kind='delivery' and trip_id is not null and customer_id is not null))
);
create unique index inventory_load_once on public.inventory_operations(tenant_id,trip_id) where kind='load';
create unique index inventory_close_once on public.inventory_operations(tenant_id,trip_id) where kind='close';
create index inventory_operations_trip on public.inventory_operations(tenant_id,trip_id);
create index inventory_operations_actor on public.inventory_operations(tenant_id,actor_id);
create index inventory_operations_customer on public.inventory_operations(tenant_id,trip_id,customer_id);
create table public.inventory_movements (
 tenant_id uuid not null,
 operation_id uuid not null,
 product_id uuid not null,
 depot_ready integer not null default 0,
 truck_ready integer not null default 0,
 depot_empty integer not null default 0,
 truck_empty integer not null default 0,
 customer_held integer not null default 0,
 unit_price numeric(14,2) not null check(unit_price>=0),
 primary key(tenant_id,operation_id,product_id),
 foreign key(tenant_id,operation_id) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id),
 check(depot_ready<>0 or truck_ready<>0 or depot_empty<>0 or truck_empty<>0)
);
create index inventory_movements_product on public.inventory_movements(tenant_id,product_id);

create function private.inventory_product_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.unit,new.kind,new.returnable) is distinct from (old.unit,old.kind,old.returnable)
 and exists(select 1 from public.inventory_movements where tenant_id=old.tenant_id and product_id=old.id) then
  raise exception 'El artículo ya tiene movimientos; creá otra presentación para cambiar unidad o modalidad';
 end if;
 return new;
end $$;
revoke all on function private.inventory_product_identity() from public,anon,authenticated;
create trigger inventory_product_identity before update on public.products for each row execute function private.inventory_product_identity();

create function private.inventory_trip_access(t uuid, trip uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(t,array['owner']) or
 (private.has_role(t,array['driver']) and exists(select 1 from public.inventory_trips r where r.tenant_id=t and r.id=trip and r.driver_id=(select auth.uid())));
$$;
revoke all on function private.inventory_trip_access(uuid,uuid) from public,anon;
grant execute on function private.inventory_trip_access(uuid,uuid) to authenticated;
alter table public.inventory_trips enable row level security;
alter table public.inventory_trip_customers enable row level security;
alter table public.inventory_operations enable row level security;
alter table public.inventory_movements enable row level security;
create policy inventory_trips_read on public.inventory_trips for select to authenticated using(private.inventory_trip_access(tenant_id,id));
create policy inventory_trip_customers_read on public.inventory_trip_customers for select to authenticated using(private.inventory_trip_access(tenant_id,trip_id));
create policy inventory_operations_read on public.inventory_operations for select to authenticated using(private.inventory_trip_access(tenant_id,trip_id));
create policy inventory_movements_read on public.inventory_movements for select to authenticated using(exists(select 1 from public.inventory_operations o where o.tenant_id=inventory_movements.tenant_id and o.id=inventory_movements.operation_id));
revoke all on public.inventory_trips,public.inventory_trip_customers,public.inventory_operations,public.inventory_movements from public,anon,authenticated;
grant select on public.inventory_trips,public.inventory_trip_customers,public.inventory_operations,public.inventory_movements to authenticated;

-- Jefe crea reparto y asignaciones; IDs proporcionados por cliente permiten reintentar.
create function public.inventory_create_trip(p_tenant uuid,p_id uuid,p_driver uuid,p_name text,p_date date,p_customers uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.inventory_trips;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=p_driver and active) then raise exception 'Repartidor no habilitado'; end if;
 if p_customers is null or cardinality(p_customers)=0 or cardinality(p_customers)>500 then raise exception 'Asigná entre 1 y 500 clientes'; end if;
 if exists(select 1 from unnest(p_customers) c where not exists(select 1 from public.customers where tenant_id=p_tenant and id=c and active)) then raise exception 'Cliente no habilitado'; end if;
 select * into existing from public.inventory_trips where id=p_id;
 if found then
  if existing.tenant_id=p_tenant and existing.driver_id=p_driver and existing.name=p_name and existing.service_date=p_date
   and (select array_agg(customer_id order by customer_id) from public.inventory_trip_customers where tenant_id=p_tenant and trip_id=p_id)=(select array_agg(distinct c order by c) from unnest(p_customers) c) then return p_id; end if;
  raise exception 'ID de reparto ya utilizado con otros datos';
 end if;
 insert into public.inventory_trips(id,tenant_id,driver_id,name,service_date) values(p_id,p_tenant,p_driver,p_name,p_date);
 insert into public.inventory_trip_customers select distinct p_tenant,p_id,c from unnest(p_customers) c;
 return p_id;
end $$;

-- Todas las escrituras de stock pasan por esta transacción. Bloqueo por empresa:
-- evita sobreventa concurrente y mantiene consistentes los saldos derivados del libro.
create function public.inventory_post(p_tenant uuid,p_id uuid,p_kind text,p_trip uuid,p_customer uuid,p_items jsonb,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare
 t public.inventory_trips; previous public.inventory_operations; p public.products;
 item jsonb; q numeric; r numeric; product uuid; seen uuid[]='{}';
 depot bigint; truck bigint; empty_truck bigint; held bigint; total_units bigint=0;
begin
 if not private.has_role(p_tenant,array['owner','driver']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if p_kind is null or p_kind not in ('receive','load','delivery','close') then raise exception 'Movimiento inválido'; end if;
 if p_kind in ('receive','close') and not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede ingresar o aprobar stock' using errcode='42501'; end if;
 if p_kind='receive' then
  if p_trip is not null or p_customer is not null then raise exception 'Ingreso solo al depósito'; end if;
 else
  select * into t from public.inventory_trips where tenant_id=p_tenant and id=p_trip for update;
  if not found or not private.inventory_trip_access(p_tenant,p_trip) then raise exception 'Reparto no asignado' using errcode='42501'; end if;
 end if;
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.kind=p_kind and previous.trip_id is not distinct from p_trip and previous.customer_id is not distinct from p_customer and previous.items=p_items and previous.note=p_note then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 if p_kind='load' and t.status<>'planned' then raise exception 'Carga ya confirmada; no se puede editar ni recargar'; end if;
 if p_kind='delivery' and t.status<>'active' then raise exception 'El reparto no está activo'; end if;
 if p_kind='close' and t.status<>'submitted' then raise exception 'El reparto no está pendiente de aprobación'; end if;
 if p_kind='load' and exists(select 1 from public.inventory_trips where tenant_id=p_tenant and driver_id=t.driver_id and id<>p_trip and status in ('active','submitted')) then raise exception 'Cerrá y aprobá el reparto anterior'; end if;
 if p_kind='delivery' and not exists(select 1 from public.inventory_trip_customers a join public.customers c on c.tenant_id=a.tenant_id and c.id=a.customer_id where a.tenant_id=p_tenant and a.trip_id=p_trip and a.customer_id=p_customer and c.active) then raise exception 'Cliente no asignado o inactivo'; end if;
 if p_kind<>'delivery' and p_customer is not null then raise exception 'Cliente solo en entregas'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Artículos inválidos'; end if;
 if jsonb_array_length(p_items)>200 or (p_kind<>'close' and jsonb_array_length(p_items)=0) then raise exception 'Ingresá entre 1 y 200 artículos'; end if;
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,customer_id,actor_id,items,note) values(p_tenant,p_id,p_kind,p_trip,p_customer,auth.uid(),p_items,p_note);
 for item in select value from jsonb_array_elements(p_items) loop
  product:=(item->>'product_id')::uuid; q:=(item->>'quantity')::numeric; r:=coalesce((item->>'returned')::numeric,0);
  if q is null or q<0 or q>100000 or q<>trunc(q) or r<0 or r>100000 or r<>trunc(r) or (q+r=0 and p_kind<>'close') then raise exception 'Usá cantidades enteras entre 0 y 100000, con algún movimiento'; end if;
  if product=any(seen) then raise exception 'Artículo repetido'; end if;
  seen:=array_append(seen,product); total_units:=total_units+q+r;
  select * into p from public.products where tenant_id=p_tenant and id=product for share;
  if not found or (not p.active and p_kind<>'close') then raise exception 'Artículo no habilitado'; end if;
  if r>0 and (p_kind<>'delivery' or not p.returnable) then raise exception 'Devolución inválida'; end if;
  select coalesce(sum(m.depot_ready),0),coalesce(sum(m.truck_ready) filter(where o.trip_id=p_trip),0),coalesce(sum(m.truck_empty) filter(where o.trip_id=p_trip),0),coalesce(sum(m.customer_held) filter(where o.customer_id=p_customer),0)
  into depot,truck,empty_truck,held from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=product;
  if p_kind='load' and q>depot then raise exception 'Stock insuficiente en depósito'; end if;
  if p_kind='delivery' and q>truck then raise exception 'Stock insuficiente en camión'; end if;
  if p_kind='delivery' and r>held+q then raise exception 'Devuelve más envases de los que tiene'; end if;
  if p_kind='close' and q<>truck then raise exception 'El regreso no coincide con el stock; revisar antes de aprobar'; end if;
  if p_kind='close' and q=0 and empty_truck=0 then continue; end if;
  insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,truck_ready,depot_empty,truck_empty,customer_held,unit_price)
  values(p_tenant,p_id,product,
   case p_kind when 'receive' then q when 'load' then -q when 'close' then q else 0 end,
   case p_kind when 'load' then q when 'delivery' then -q when 'close' then -q else 0 end,
   case when p_kind='close' then empty_truck else 0 end,
   case p_kind when 'delivery' then r when 'close' then -empty_truck else 0 end,
   case when p_kind='delivery' and p.returnable then q-r else 0 end,p.price);
 end loop;
 if p_kind='close' and exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and o.trip_id=p_trip group by m.product_id having sum(m.truck_ready)<>0 or sum(m.truck_empty)<>0) then raise exception 'Faltan artículos en el conteo de regreso'; end if;
 if p_kind='load' then update public.inventory_trips set status='active',started_at=now() where tenant_id=p_tenant and id=p_trip; end if;
 if p_kind='close' then update public.inventory_trips set status='closed',closed_at=now() where tenant_id=p_tenant and id=p_trip; end if;
 return p_id;
end $$;

create function public.inventory_submit_trip(p_tenant uuid,p_trip uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.inventory_trip_access(p_tenant,p_trip) then raise exception 'Reparto no asignado' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='submitted') then return; end if;
 update public.inventory_trips set status='submitted',submitted_at=now() where tenant_id=p_tenant and id=p_trip and status='active';
 if not found then raise exception 'El reparto no está activo'; end if;
end $$;

-- Saldos calculados con los permisos del solicitante. El chofer ve su camión,
-- no el depósito ni los movimientos de otros asistentes.
create view public.inventory_truck_stock with(security_invoker=true) as
 select o.tenant_id,o.trip_id,m.product_id,
 coalesce(sum(m.truck_ready) filter(where o.kind='load'),0)::bigint as loaded,
 sum(m.truck_ready)::bigint as ready,sum(m.truck_empty)::bigint as empties,
 coalesce(sum(-m.truck_ready*m.unit_price) filter(where o.kind='delivery'),0) as delivered_amount
 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id
 where o.trip_id is not null group by o.tenant_id,o.trip_id,m.product_id;
create view public.inventory_depot_stock with(security_invoker=true) as
 select m.tenant_id,m.product_id,sum(m.depot_ready)::bigint as ready,sum(m.depot_empty)::bigint as empties
 from public.inventory_movements m where private.has_role(m.tenant_id,array['owner']) group by m.tenant_id,m.product_id;
create view public.inventory_customer_containers with(security_invoker=true) as
 select o.tenant_id,o.customer_id,m.product_id,sum(m.customer_held)::bigint as quantity
 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id
 where o.customer_id is not null and private.has_role(o.tenant_id,array['owner']) group by o.tenant_id,o.customer_id,m.product_id;
-- La vista de envases completa es del jefe: un chofer no debe ver un saldo
-- parcial por tener acceso únicamente a algunos repartos históricos.
revoke all on public.inventory_truck_stock,public.inventory_depot_stock,public.inventory_customer_containers from public,anon,authenticated;
grant select on public.inventory_truck_stock,public.inventory_depot_stock,public.inventory_customer_containers to authenticated;
revoke all on function public.inventory_create_trip(uuid,uuid,uuid,text,date,uuid[]), public.inventory_post(uuid,uuid,text,uuid,uuid,jsonb,text),public.inventory_submit_trip(uuid,uuid) from public,anon,authenticated;
grant execute on function public.inventory_create_trip(uuid,uuid,uuid,text,date,uuid[]), public.inventory_post(uuid,uuid,text,uuid,uuid,jsonb,text),public.inventory_submit_trip(uuid,uuid) to authenticated;
commit;
