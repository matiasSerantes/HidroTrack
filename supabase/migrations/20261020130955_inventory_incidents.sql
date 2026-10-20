begin;
alter table public.products add column family text not null default 'article' check(family in ('article','dispenser'));
update public.products set family='dispenser' where name ~* '(dispenser|surtidor)';
create function private.inventory_product_family() returns trigger language plpgsql set search_path='' as $$
begin
 if new.family='article' and new.name ~* '(dispenser|surtidor)' then new.family:='dispenser'; end if;
 return new;
end $$;
create trigger inventory_product_family before insert on public.products for each row execute function private.inventory_product_family();
revoke all on function private.inventory_product_family() from public,anon,authenticated;
alter table public.inventory_operations add column occurred_on date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date;
alter table public.inventory_operations add column involved_kind text check(involved_kind in ('owner','driver','customer'));
alter table public.inventory_operations add column involved_id uuid;
alter table public.inventory_operations add column source text check(source in ('depot_ready','depot_empty','truck_ready','truck_empty','customer_held'));
-- Existing records already have their immutable registration timestamp.
update public.inventory_operations set occurred_on=(created_at at time zone 'America/Argentina/Buenos_Aires')::date;
alter table public.inventory_operations drop constraint inventory_operations_kind_check;
alter table public.inventory_operations add constraint inventory_operations_kind_check check(kind in ('receive','load','delivery','close','receive_empty','refill','opening_customer','remove','damage'));
alter table public.inventory_operations drop constraint inventory_operation_scope;
alter table public.inventory_operations add constraint inventory_operation_scope check(
 (kind in ('receive','receive_empty','refill') and trip_id is null and customer_id is null)
 or (kind in ('load','close') and trip_id is not null and customer_id is null)
 or (kind='delivery' and trip_id is not null and customer_id is not null)
 or (kind='opening_customer' and trip_id is null and customer_id is not null)
 or (kind in ('remove','damage') and source is not null and
  ((source in ('depot_ready','depot_empty') and trip_id is null and customer_id is null)
   or (source in ('truck_ready','truck_empty') and trip_id is not null and customer_id is null)
   or (source='customer_held' and trip_id is null and customer_id is not null))));

create function public.inventory_record_stock(p_tenant uuid,p_id uuid,p_kind text,p_trip uuid,p_customer uuid,p_items jsonb,p_note text,p_date date) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_operations; result uuid;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede registrar este movimiento' using errcode='42501'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha inválida o futura'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found and previous.occurred_on<>p_date then raise exception 'ID de operación ya utilizado con otra fecha'; end if;
 if p_kind in ('receive_empty','refill','opening_customer') and p_trip is null then
  result:=public.inventory_owner_stock(p_tenant,p_id,p_kind,p_customer,p_items,p_note);
 elsif p_kind in ('receive','load') then
  result:=public.inventory_post(p_tenant,p_id,p_kind,p_trip,p_customer,p_items,p_note);
 else raise exception 'Movimiento no permitido'; end if;
 update public.inventory_operations set occurred_on=p_date where tenant_id=p_tenant and id=p_id;
 return result;
end $$;

create function public.inventory_remove(p_tenant uuid,p_id uuid,p_kind text,p_product uuid,p_quantity integer,p_source text,p_trip uuid,p_customer uuid,p_date date,p_involved_kind text,p_involved_id uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_operations; p public.products; available bigint; payload jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede registrar bajas o roturas' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('remove','damage') or p_quantity is null or p_quantity not between 1 and 100000 then raise exception 'Movimiento o cantidad inválida'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha inválida o futura'; end if;
 if p_note is null or length(trim(p_note)) not between 1 and 400 then raise exception 'Indicá el motivo'; end if;
 if p_involved_kind is null or p_involved_kind not in ('owner','driver','customer') then raise exception 'Indicá a quién le ocurrió'; end if;
 if p_involved_kind='customer' then
  if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_involved_id) then raise exception 'Cliente no válido'; end if;
 elsif not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=p_involved_id and role=p_involved_kind and active) then raise exception 'Usuario no válido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',p_quantity));
 select * into previous from public.inventory_operations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.kind=p_kind and previous.items=payload and previous.source=p_source and previous.trip_id is not distinct from p_trip and previous.customer_id is not distinct from p_customer and previous.occurred_on=p_date and previous.involved_kind=p_involved_kind and previous.involved_id=p_involved_id and previous.note=p_note then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 select * into p from public.products where tenant_id=p_tenant and id=p_product;
 if not found then raise exception 'Artículo no válido'; end if;
 if p_source in ('depot_ready','depot_empty') and p_trip is null and p_customer is null then
  select coalesce(sum(case p_source when 'depot_ready' then m.depot_ready else m.depot_empty end),0) into available from public.inventory_movements m where m.tenant_id=p_tenant and m.product_id=p_product;
 elsif p_source in ('truck_ready','truck_empty') and p_customer is null and exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status in ('active','submitted')) then
  select coalesce(sum(case p_source when 'truck_ready' then m.truck_ready else m.truck_empty end),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p_product and o.trip_id=p_trip;
 elsif p_source='customer_held' and p_trip is null and exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer) then
  select coalesce(sum(m.customer_held),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p_product and o.customer_id=p_customer;
 else raise exception 'Ubicación inválida'; end if;
 if p_quantity>available then raise exception 'No hay suficientes unidades en esa ubicación'; end if;
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,customer_id,actor_id,items,note,occurred_on,involved_kind,involved_id,source)
 values(p_tenant,p_id,p_kind,p_trip,p_customer,auth.uid(),payload,p_note,p_date,p_involved_kind,p_involved_id,p_source);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,truck_ready,truck_empty,customer_held,unit_price)
 values(p_tenant,p_id,p_product,case when p_source='depot_ready' then -p_quantity else 0 end,case when p_source='depot_empty' then -p_quantity else 0 end,case when p_source='truck_ready' then -p_quantity else 0 end,case when p_source='truck_empty' then -p_quantity else 0 end,case when p_source='customer_held' then -p_quantity else 0 end,p.price);
 return p_id;
end $$;

alter table public.dispensers add column retired boolean not null default false;
alter table public.dispenser_events add column occurred_on date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date;
alter table public.dispenser_events add column incident jsonb;
update public.dispenser_events set occurred_on=(created_at at time zone 'America/Argentina/Buenos_Aires')::date;
create function public.inventory_retire_dispenser(p_tenant uuid,p_id uuid,p_asset uuid,p_date date,p_involved_kind text,p_involved_id uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.dispensers; previous public.dispenser_events; detail jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede registrar la rotura' using errcode='42501'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 400 then raise exception 'Fecha o motivo inválido'; end if;
 if p_involved_kind='customer' then
  if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_involved_id) then raise exception 'Cliente no válido'; end if;
 elsif p_involved_kind in ('owner','driver') then
  if not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=p_involved_id and role=p_involved_kind and active) then raise exception 'Usuario no válido'; end if;
 else raise exception 'Indicá a quién le ocurrió'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 detail:=jsonb_build_object('kind','damage','involved_kind',p_involved_kind,'involved_id',p_involved_id,'note',p_note);
 select * into previous from public.dispenser_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.dispenser_id=p_asset and previous.occurred_on=p_date and previous.incident=detail then return p_id; end if;
  raise exception 'ID de operación ya utilizado con otros datos';
 end if;
 select * into a from public.dispensers where tenant_id=p_tenant and id=p_asset;
 if not found or a.retired then raise exception 'Dispenser no disponible'; end if;
 update public.dispensers set retired=true,updated_at=now() where tenant_id=p_tenant and id=p_asset;
 insert into public.dispenser_events(tenant_id,id,dispenser_id,actor_id,old_value,new_value,occurred_on,incident)
 values(p_tenant,p_id,p_asset,auth.uid(),to_jsonb(a),to_jsonb(a)||'{"retired":true}'::jsonb,p_date,detail);
 return p_asset;
end $$;
-- Retired equipment cannot be silently made available through the old save RPC.
create function private.dispenser_retired_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.retired then raise exception 'El dispenser ya fue dado de baja'; end if;
 return new;
end $$;
create trigger dispenser_retired_guard before update on public.dispensers for each row execute function private.dispenser_retired_guard();
revoke all on function private.dispenser_retired_guard() from public,anon,authenticated;
revoke all on function public.inventory_record_stock(uuid,uuid,text,uuid,uuid,jsonb,text,date),public.inventory_remove(uuid,uuid,text,uuid,integer,text,uuid,uuid,date,text,uuid,text),public.inventory_retire_dispenser(uuid,uuid,uuid,date,text,uuid,text) from public,anon,authenticated;
grant execute on function public.inventory_record_stock(uuid,uuid,text,uuid,uuid,jsonb,text,date),public.inventory_remove(uuid,uuid,text,uuid,integer,text,uuid,uuid,date,text,uuid,text),public.inventory_retire_dispenser(uuid,uuid,uuid,date,text,uuid,text) to authenticated;
commit;
