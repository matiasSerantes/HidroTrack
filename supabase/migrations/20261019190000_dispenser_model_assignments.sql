begin;
create table public.dispenser_assignments(
 tenant_id uuid not null references public.tenants(id),
 id uuid not null,
 product_id uuid not null,
 customer_id uuid not null,
 mode text not null check(mode in ('loan','rental')),
 monthly numeric(14,2) not null check(monthly>=0),
 status text not null default 'active' check(status in ('active','returned','damaged','removed')),
 occurred_on date not null,
 closed_on date,
 last_operation uuid not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,id) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,last_operation) references public.inventory_operations(tenant_id,id),
 check((mode='loan' and monthly=0) or (mode='rental' and monthly>0)),
 check((status='active' and closed_on is null) or (status<>'active' and closed_on is not null))
);
create index dispenser_assignments_customer on public.dispenser_assignments(tenant_id,customer_id,status);
create index dispenser_assignments_product on public.dispenser_assignments(tenant_id,product_id,status);
alter table public.dispenser_assignments enable row level security;
create policy dispenser_assignments_owner on public.dispenser_assignments for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.dispenser_assignments from public,anon,authenticated;
grant select on public.dispenser_assignments to authenticated;
alter table public.inventory_operations drop constraint inventory_operations_kind_check;
alter table public.inventory_operations add constraint inventory_operations_kind_check check(kind in ('receive','load','delivery','close','receive_empty','refill','opening_customer','remove','damage','dispenser_assign','dispenser_return'));
alter table public.inventory_operations drop constraint inventory_operation_scope;
alter table public.inventory_operations add constraint inventory_operation_scope check(
 (kind in ('receive','receive_empty','refill') and trip_id is null and customer_id is null)
 or (kind in ('load','close') and trip_id is not null and customer_id is null)
 or (kind='delivery' and trip_id is not null and customer_id is not null)
 or (kind='opening_customer' and trip_id is null and customer_id is not null)
 or (kind='dispenser_assign' and customer_id is not null and ((trip_id is null and source='depot_ready') or (trip_id is not null and source='truck_ready')))
 or (kind='dispenser_return' and customer_id is not null and trip_id is null and source='customer_held')
 or (kind in ('remove','damage') and source is not null and
  ((source in ('depot_ready','depot_empty') and trip_id is null and customer_id is null)
   or (source in ('truck_ready','truck_empty') and trip_id is not null and customer_id is null)
   or (source='customer_held' and trip_id is null and customer_id is not null))));

create function public.inventory_assign_dispenser_model(p_tenant uuid,p_id uuid,p_product uuid,p_customer uuid,p_mode text,p_monthly numeric,p_date date,p_trip uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_operations; assignment public.dispenser_assignments; p public.products; available bigint; payload jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede asignar dispenser' using errcode='42501'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha inválida'; end if;
 if p_mode is null or p_mode not in ('loan','rental') or p_monthly is null or p_monthly<>round(p_monthly,2) or p_monthly<0 or p_monthly>999999999999.99 or (p_mode='loan' and p_monthly<>0) or (p_mode='rental' and p_monthly<=0) then raise exception 'Modalidad o alquiler inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',1));
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  select * into assignment from public.dispenser_assignments where tenant_id=p_tenant and id=p_id;
  if previous.actor_id=auth.uid() and previous.kind='dispenser_assign' and previous.items=payload and previous.customer_id=p_customer and previous.trip_id is not distinct from p_trip and previous.occurred_on=p_date and assignment.mode=p_mode and assignment.monthly=p_monthly then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 select * into p from public.products where tenant_id=p_tenant and id=p_product and active and family='dispenser';
 if not found then raise exception 'Modelo dispenser no habilitado'; end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no habilitado'; end if;
 if p_trip is null then
  select coalesce(sum(depot_ready),0) into available from public.inventory_movements where tenant_id=p_tenant and product_id=p_product;
 else
  if not exists(select 1 from public.inventory_trips t join public.inventory_trip_customers c on c.tenant_id=t.tenant_id and c.trip_id=t.id where t.tenant_id=p_tenant and t.id=p_trip and t.status='active' and c.customer_id=p_customer) then raise exception 'El cliente no está en ese reparto activo'; end if;
  select coalesce(sum(m.truck_ready),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p_product and o.trip_id=p_trip;
 end if;
 if available<1 then raise exception 'No quedan dispenser disponibles en esa ubicación'; end if;
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,customer_id,actor_id,items,note,occurred_on,source)
 values(p_tenant,p_id,'dispenser_assign',p_trip,p_customer,auth.uid(),payload,'Asignación de dispenser desde stock',p_date,case when p_trip is null then 'depot_ready' else 'truck_ready' end);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,truck_ready,customer_held,unit_price)
 values(p_tenant,p_id,p_product,case when p_trip is null then -1 else 0 end,case when p_trip is null then 0 else -1 end,1,p.price);
 insert into public.dispenser_assignments(tenant_id,id,product_id,customer_id,mode,monthly,occurred_on,last_operation)
 values(p_tenant,p_id,p_product,p_customer,p_mode,p_monthly,p_date,p_id);
 return p_id;
end $$;

create function public.inventory_return_dispenser_model(p_tenant uuid,p_id uuid,p_assignment uuid,p_date date) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.dispenser_assignments; previous public.inventory_operations; payload jsonb; price numeric; available bigint;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede registrar devoluciones' using errcode='42501'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha inválida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into a from public.dispenser_assignments where tenant_id=p_tenant and id=p_assignment;
 if not found then raise exception 'Asignación no válida'; end if;
 payload:=jsonb_build_array(jsonb_build_object('product_id',a.product_id,'quantity',1,'assignment_id',p_assignment));
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.kind='dispenser_return' and previous.items=payload and previous.occurred_on=p_date then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 if a.status<>'active' or p_date<a.occurred_on then raise exception 'El dispenser no está activo o la fecha es anterior a la entrega'; end if;
 select coalesce(sum(m.customer_held),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=a.product_id and o.customer_id=a.customer_id;
 if available<1 then raise exception 'No hay dispenser pendiente de devolución'; end if;
 select p.price into price from public.products p where p.tenant_id=p_tenant and p.id=a.product_id;
 insert into public.inventory_operations(tenant_id,id,kind,customer_id,actor_id,items,note,occurred_on,source)
 values(p_tenant,p_id,'dispenser_return',a.customer_id,auth.uid(),payload,'Devolución de dispenser al depósito',p_date,'customer_held');
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,customer_held,unit_price) values(p_tenant,p_id,a.product_id,1,-1,price);
 update public.dispenser_assignments set status='returned',closed_on=p_date,last_operation=p_id where tenant_id=p_tenant and id=p_assignment;
 return p_id;
end $$;

-- A customer-side stock write-off also closes the affected unit assignments.
create function private.dispenser_assignment_damage() returns trigger
language plpgsql security definer set search_path='' as $$
declare operation public.inventory_operations;
begin
 if new.customer_held<0 then
  select * into operation from public.inventory_operations where tenant_id=new.tenant_id and id=new.operation_id;
  if operation.kind in ('damage','remove') then
   if exists(select 1 from (select occurred_on from public.dispenser_assignments where tenant_id=new.tenant_id and product_id=new.product_id and customer_id=operation.customer_id and status='active' order by occurred_on,id limit (-new.customer_held)) affected where affected.occurred_on>operation.occurred_on) then raise exception 'La fecha de baja es anterior a la entrega del dispenser'; end if;
   update public.dispenser_assignments set status=case when operation.kind='damage' then 'damaged' else 'removed' end,closed_on=operation.occurred_on,last_operation=operation.id
   where tenant_id=new.tenant_id and id in (
    select id from public.dispenser_assignments where tenant_id=new.tenant_id and product_id=new.product_id and customer_id=operation.customer_id and status='active' order by occurred_on,id limit (-new.customer_held));
  end if;
 end if;
 return new;
end $$;
create trigger dispenser_assignment_damage after insert on public.inventory_movements for each row execute function private.dispenser_assignment_damage();
revoke all on function private.dispenser_assignment_damage() from public,anon,authenticated;
revoke all on function public.inventory_assign_dispenser_model(uuid,uuid,uuid,uuid,text,numeric,date,uuid),public.inventory_return_dispenser_model(uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.inventory_assign_dispenser_model(uuid,uuid,uuid,uuid,text,numeric,date,uuid),public.inventory_return_dispenser_model(uuid,uuid,uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
