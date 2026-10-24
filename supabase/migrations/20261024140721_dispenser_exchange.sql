begin;
alter table public.dispenser_assignments add column last_exchange_on date;
-- Preserve all existing operation scopes, including promotions.
do $$ declare definition text; begin
 select pg_get_constraintdef(oid) into definition from pg_constraint where conrelid='public.inventory_operations'::regclass and conname='inventory_operation_scope';
 if definition is null then raise exception 'Falta contrato de ubicaciones'; end if;
 alter table public.inventory_operations drop constraint inventory_operation_scope;
 execute 'alter table public.inventory_operations add constraint inventory_operation_scope check ('||substring(definition from 7)||' or (kind=''dispenser_return'' and customer_id is not null and trip_id is not null and source=''customer_held''))';
end $$;

create table public.dispenser_exchanges(
 tenant_id uuid not null,
 id uuid not null,
 replacement_operation uuid not null,
 assignment_id uuid not null,
 customer_id uuid not null,
 old_product uuid not null,
 new_product uuid not null,
 trip_id uuid,
 occurred_on date not null,
 returned_state text not null check(returned_state in ('good','broken')),
 involved_kind text check(involved_kind in ('owner','driver','customer')),
 involved_id uuid,
 note text not null check(length(note)<=400),
 mode text not null,
 monthly numeric(14,2) not null,
 rental_anchor date not null,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 unique(tenant_id,replacement_operation),
 foreign key(tenant_id,id) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,replacement_operation) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,assignment_id) references public.dispenser_assignments(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,old_product) references public.products(tenant_id,id),
 foreign key(tenant_id,new_product) references public.products(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 check(id<>replacement_operation)
);
alter table public.dispenser_exchanges enable row level security;
revoke all on public.dispenser_exchanges from public,anon,authenticated;
grant select on public.dispenser_exchanges to authenticated;
create policy dispenser_exchange_owner on public.dispenser_exchanges for select to authenticated using(private.has_role(tenant_id,array['owner']));

create function public.inventory_exchange_dispenser(p_tenant uuid,p_id uuid,p_replacement_id uuid,p_assignment uuid,p_product uuid,p_date date,p_state text,p_involved text default null,p_note text default '',p_trip uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.dispenser_assignments; previous public.dispenser_exchanges; model public.products; stock bigint; held bigint; responsible uuid; old_price numeric;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede cambiar dispenser' using errcode='42501'; end if;
 if p_id is null or p_replacement_id is null or p_id=p_replacement_id or p_date is null or p_state is null or p_state not in ('good','broken') or p_note is null or length(p_note)>400 then raise exception 'Cambio invalido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.dispenser_exchanges where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.replacement_operation=p_replacement_id and previous.assignment_id=p_assignment and previous.new_product=p_product and previous.occurred_on=p_date and previous.returned_state=p_state and previous.involved_kind is not distinct from p_involved and previous.note=p_note and previous.trip_id is not distinct from p_trip then return p_id; end if;
  raise exception 'ID reutilizado con otros datos';
 end if;
 if p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha futura no permitida'; end if;
 if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id in (p_id,p_replacement_id)) then raise exception 'ID de operacion ya usado'; end if;
 select * into a from public.dispenser_assignments where tenant_id=p_tenant and id=p_assignment for update;
 if not found or a.status<>'active' or p_date<greatest(a.occurred_on,coalesce(a.last_exchange_on,a.occurred_on)) then raise exception 'Asignacion o fecha no valida'; end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=a.customer_id and active and not pending_recovery) then raise exception 'Cliente inactivo o pendiente de recuperacion'; end if;
 select * into model from public.products where tenant_id=p_tenant and id=p_product and family='dispenser' and active;
 if not found then raise exception 'Modelo de reemplazo no habilitado'; end if;
 if p_trip is not null and not exists(select 1 from public.inventory_trips t join public.route_stops s on s.tenant_id=t.tenant_id and s.trip_id=t.id where t.tenant_id=p_tenant and t.id=p_trip and t.status='active' and s.customer_id=a.customer_id and s.active and exists(select 1 from public.inventory_operations o where o.tenant_id=t.tenant_id and o.trip_id=t.id and o.kind='load' and o.occurred_on<=p_date)) then raise exception 'Cliente fuera del reparto activo'; end if;
 if p_state='broken' then
  if p_involved='customer' then responsible:=a.customer_id;
  elsif p_involved='owner' then responsible:=auth.uid();
  elsif p_involved='driver' and p_trip is not null then
   select t.driver_id into responsible from public.inventory_trips t join public.tenant_members m on m.tenant_id=t.tenant_id and m.user_id=t.driver_id and m.role='driver' and m.active where t.tenant_id=p_tenant and t.id=p_trip;
  else raise exception 'Indica con quien se rompio'; end if;
  if responsible is null then raise exception 'Responsable no habilitado'; end if;
 elsif p_involved is not null then raise exception 'Responsable solo para rotura'; end if;
 -- Count replacement before crediting the returned unit, even for the same model.
 if p_trip is null then select coalesce(sum(depot_ready),0) into stock from public.inventory_movements where tenant_id=p_tenant and product_id=p_product;
 else select coalesce(sum(m.truck_ready),0) into stock from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p_product and o.trip_id=p_trip;
 end if;
 if stock<1 then raise exception 'No hay reemplazo disponible en esa ubicacion'; end if;
 select coalesce(sum(m.customer_held),0) into held from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=a.product_id and o.customer_id=a.customer_id;
 if held<1 then raise exception 'No hay unidad anterior para retirar'; end if;
 select price into old_price from public.products where tenant_id=p_tenant and id=a.product_id;
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,customer_id,actor_id,items,note,occurred_on,source,involved_kind,involved_id)
 values(p_tenant,p_id,'dispenser_return',p_trip,a.customer_id,auth.uid(),jsonb_build_array(jsonb_build_object('product_id',a.product_id,'quantity',1,'assignment_id',a.id)),case when p_state='broken' then 'Cambio: retirado roto, baja definitiva' else 'Cambio: retirado en buen estado' end,p_date,'customer_held',p_involved,responsible);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,truck_ready,customer_held,unit_price)
 values(p_tenant,p_id,a.product_id,case when p_state='good' and p_trip is null then 1 else 0 end,case when p_state='good' and p_trip is not null then 1 else 0 end,-1,old_price);
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,customer_id,actor_id,items,note,occurred_on,source)
 values(p_tenant,p_replacement_id,'dispenser_assign',p_trip,a.customer_id,auth.uid(),jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',1)), 'Cambio: unidad de reemplazo',p_date,case when p_trip is null then 'depot_ready' else 'truck_ready' end);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,truck_ready,customer_held,unit_price)
 values(p_tenant,p_replacement_id,p_product,case when p_trip is null then -1 else 0 end,case when p_trip is null then 0 else -1 end,1,model.price);
 update public.dispenser_assignments set product_id=p_product,last_operation=p_replacement_id,last_exchange_on=p_date where tenant_id=p_tenant and id=p_assignment;
 insert into public.dispenser_exchanges(tenant_id,id,replacement_operation,assignment_id,customer_id,old_product,new_product,trip_id,occurred_on,returned_state,involved_kind,involved_id,note,mode,monthly,rental_anchor,actor_id)
 values(p_tenant,p_id,p_replacement_id,p_assignment,a.customer_id,a.product_id,p_product,p_trip,p_date,p_state,p_involved,responsible,p_note,a.mode,a.monthly,a.occurred_on,auth.uid());
 return p_id;
end $$;
revoke all on function public.inventory_exchange_dispenser(uuid,uuid,uuid,uuid,uuid,date,text,text,text,uuid) from public,anon;
grant execute on function public.inventory_exchange_dispenser(uuid,uuid,uuid,uuid,uuid,date,text,text,text,uuid) to authenticated;
create or replace function public.inventory_return_dispenser_model(p_tenant uuid,p_id uuid,p_assignment uuid,p_date date) returns uuid
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
 if a.status<>'active' or p_date<greatest(a.occurred_on,coalesce(a.last_exchange_on,a.occurred_on)) then raise exception 'El dispenser no está activo o la fecha es anterior a la entrega'; end if;
 select coalesce(sum(m.customer_held),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=a.product_id and o.customer_id=a.customer_id;
 if available<1 then raise exception 'No hay dispenser pendiente de devolución'; end if;
 select p.price into price from public.products p where p.tenant_id=p_tenant and p.id=a.product_id;
 insert into public.inventory_operations(tenant_id,id,kind,customer_id,actor_id,items,note,occurred_on,source)
 values(p_tenant,p_id,'dispenser_return',a.customer_id,auth.uid(),payload,'Devolución de dispenser al depósito',p_date,'customer_held');
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,customer_held,unit_price) values(p_tenant,p_id,a.product_id,1,-1,price);
 update public.dispenser_assignments set status='returned',closed_on=p_date,last_operation=p_id where tenant_id=p_tenant and id=p_assignment;
 return p_id;
end $$;


create or replace function private.dispenser_assignment_damage() returns trigger
language plpgsql security definer set search_path='' as $$
declare operation public.inventory_operations;
begin
 if new.customer_held<0 then
  select * into operation from public.inventory_operations where tenant_id=new.tenant_id and id=new.operation_id;
  if operation.kind in ('damage','remove') then
   if exists(select 1 from (select greatest(occurred_on,coalesce(last_exchange_on,occurred_on)) as occurred_on from public.dispenser_assignments where tenant_id=new.tenant_id and product_id=new.product_id and customer_id=operation.customer_id and status='active' order by public.dispenser_assignments.occurred_on,id limit (-new.customer_held)) affected where affected.occurred_on>operation.occurred_on) then raise exception 'La fecha de baja es anterior a la entrega del dispenser'; end if;
   update public.dispenser_assignments set status=case when operation.kind='damage' then 'damaged' else 'removed' end,closed_on=operation.occurred_on,last_operation=operation.id
   where tenant_id=new.tenant_id and id in (
    select id from public.dispenser_assignments where tenant_id=new.tenant_id and product_id=new.product_id and customer_id=operation.customer_id and status='active' order by public.dispenser_assignments.occurred_on,id limit (-new.customer_held));
  end if;
 end if;
 return new;
end $$;

notify pgrst,'reload schema';
commit;
