begin;
-- Narrow contracts: accepted assigned driver only. No general driver RLS changes.
create function public.assistant_load_options(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare products jsonb;
begin
 if not private.accepted_trip_access(p_tenant,p_trip) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='planned') then raise exception 'Carga no disponible para este reparto aceptado' using errcode='42501'; end if;
 with eligible as (
  select c.id from public.route_stops s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id
  where s.tenant_id=p_tenant and s.trip_id=p_trip and s.active and c.active and not c.pending_recovery
 ), orders as (
  select h.product_id,h.quantity::numeric quantity from public.customer_product_preferences h join eligible c on c.id=h.customer_id where h.tenant_id=p_tenant
  and not exists(select 1 from public.extra_visit_requests e where e.tenant_id=p_tenant and e.trip_id=p_trip and e.customer_id=c.id and e.state='assigned')
  union all
  select (i->>'product_id')::uuid,(i->>'quantity')::numeric from public.extra_visit_requests e join eligible c on c.id=e.customer_id
  cross join lateral jsonb_array_elements(e.items) i where e.tenant_id=p_tenant and e.trip_id=p_trip and e.state='assigned'
 ), suggested as (select product_id,sum(quantity) quantity from orders group by product_id),
 balances as (select product_id,sum(depot_ready) ready,sum(depot_empty) empties from public.inventory_movements where tenant_id=p_tenant group by product_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'unit',p.unit,'returnable',p.returnable,'family',p.family,'ready',coalesce(b.ready,0),'empties',coalesce(b.empties,0),'suggested',coalesce(s.quantity,0)) order by p.name,p.id),'[]'::jsonb)
 into products from public.products p left join suggested s on s.product_id=p.id left join balances b on b.product_id=p.id where p.tenant_id=p_tenant and p.active;
 return jsonb_build_object('date',(now() at time zone 'America/Argentina/Buenos_Aires')::date,'products',products);
end $$;

create function public.assistant_confirm_load(p_tenant uuid,p_id uuid,p_refill_id uuid,p_trip uuid,p_items jsonb,p_date date,p_fill boolean,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_load_snapshots; options jsonb; item jsonb; product public.products; quantity numeric; ready bigint; empties bigint; shortage bigint; seen uuid[]:='{}'; refills jsonb:='[]'; details jsonb; settings public.filling_cost_settings; total numeric; trip_name text;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 if p_id is null or p_refill_id is null or p_id=p_refill_id or p_fill is null or p_date is null or p_note is null or length(p_note)>400 then raise exception 'Datos de carga invalidos'; end if;
 select * into previous from public.inventory_load_snapshots where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.request_items=p_items and previous.occurred_on=p_date and previous.requested_refill_id=p_refill_id and previous.fill_empties=p_fill and previous.note=p_note then return p_id; end if;
  raise exception 'ID de carga utilizado con otros datos';
 end if;
 if p_date<>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Actualiza la carga: debe registrarse con la fecha de hoy'; end if;
 select name into trip_name from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid() and status='planned' for update;
 if not found then raise exception 'Carga ya confirmada; no se puede editar ni recargar'; end if;
 if exists(select 1 from public.inventory_trips where tenant_id=p_tenant and driver_id=auth.uid() and id<>p_trip and status in ('active','submitted')) then raise exception 'El jefe debe cerrar y aprobar el reparto anterior'; end if;
 if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id in (p_id,p_refill_id)) or exists(select 1 from public.inventory_load_preparations where tenant_id=p_tenant and requested_refill_id in (p_id,p_refill_id)) then raise exception 'ID de operacion utilizado'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Ingresa entre 1 y 200 articulos'; end if;
 options:=public.assistant_load_options(p_tenant,p_trip);
 -- Validate every line before posting. Tenant lock serializes competing loads.
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or item-'product_id'-'quantity'<>'{}'::jsonb or jsonb_typeof(item->'quantity')<>'number' then raise exception 'Linea de carga invalida'; end if;
  quantity:=(item->>'quantity')::numeric;
  if quantity is null or quantity not between 1 and 100000 or quantity<>trunc(quantity) then raise exception 'Cantidad invalida'; end if;
  select * into product from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid and active for share;
  if not found or product.id=any(seen) then raise exception 'Articulo no habilitado o repetido'; end if;
  seen:=array_append(seen,product.id);
  select coalesce(sum(depot_ready),0),coalesce(sum(depot_empty),0) into ready,empties from public.inventory_movements where tenant_id=p_tenant and product_id=product.id;
  shortage:=greatest(quantity-ready,0)::bigint;
  if shortage>0 then
   if not p_fill or not product.returnable or product.family<>'article' or shortage>empties then raise exception 'Stock insuficiente para esta carga'; end if;
   refills:=refills||jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',shortage));
  end if;
 end loop;
 if jsonb_array_length(refills)>0 then
  insert into public.inventory_operations(tenant_id,id,kind,actor_id,items,note,occurred_on) values(p_tenant,p_refill_id,'refill',auth.uid(),refills,p_note,p_date);
  insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,unit_price)
  select p_tenant,p_refill_id,p.id,(i->>'quantity')::integer,-(i->>'quantity')::integer,p.price from jsonb_array_elements(refills) i join public.products p on p.tenant_id=p_tenant and p.id=(i->>'product_id')::uuid;
 end if;
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,actor_id,items,note,occurred_on) values(p_tenant,p_id,'load',p_trip,auth.uid(),p_items,p_note,p_date);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,truck_ready,unit_price)
 select p_tenant,p_id,p.id,-(i->>'quantity')::integer,(i->>'quantity')::integer,p.price from jsonb_array_elements(p_items) i join public.products p on p.tenant_id=p_tenant and p.id=(i->>'product_id')::uuid;
 if p_fill then
  insert into public.inventory_load_preparations(tenant_id,id,requested_refill_id,refill_operation,trip_id,actor_id,items,refill_items,occurred_on,note)
  values(p_tenant,p_id,p_refill_id,case when jsonb_array_length(refills)>0 then p_refill_id else null end,p_trip,auth.uid(),p_items,refills,p_date,p_note);
 end if;
 select * into settings from public.filling_cost_settings where tenant_id=p_tenant;
 with loaded as (select (i->>'product_id')::uuid id,(i->>'quantity')::numeric quantity from jsonb_array_elements(p_items) i),
 filled as (select (i->>'product_id')::uuid id,(i->>'quantity')::numeric quantity from jsonb_array_elements(refills) i),
 costs as (select (i->>'product_id')::uuid id,(i->>'unit_cost')::numeric unit_cost from jsonb_array_elements(coalesce(settings.costs,'[]')) i),
 lines as (
  select (p->>'id')::uuid id,p->>'name' name,p->>'unit' unit,(p->>'suggested')::numeric suggested,coalesce(l.quantity,0) loaded,coalesce(f.quantity,0) refilled,
  case when coalesce(settings.enabled,false) and p->>'returnable'='true' and p->>'family'='article' then c.unit_cost else null end unit_cost
  from jsonb_array_elements(options->'products') p left join loaded l on l.id=(p->>'id')::uuid left join filled f on f.id=(p->>'id')::uuid left join costs c on c.id=(p->>'id')::uuid where l.id is not null or (p->>'suggested')::numeric>0
 )
 select coalesce(jsonb_agg(jsonb_build_object('product_id',id,'name',name,'unit',unit,'suggested',suggested,'loaded',loaded,'extra',greatest(loaded-suggested,0),'missing',greatest(suggested-loaded,0),'refilled',refilled,'unit_cost',unit_cost,'filling_cost',case when unit_cost is null then null else refilled*unit_cost end) order by name,id),'[]'::jsonb),coalesce(sum(refilled*unit_cost),0) into details,total from lines;
 insert into public.inventory_load_snapshots(tenant_id,id,trip_id,trip_name,actor_id,occurred_on,request_items,requested_refill_id,fill_empties,note,items,cost_enabled,filling_total)
 values(p_tenant,p_id,p_trip,trip_name,auth.uid(),p_date,p_items,p_refill_id,p_fill,p_note,details,coalesce(settings.enabled,false),total);
 update public.inventory_trips set status='active',started_at=now() where tenant_id=p_tenant and id=p_trip;
 return p_id;
end $$;
revoke all on function public.assistant_load_options(uuid,uuid),public.assistant_confirm_load(uuid,uuid,uuid,uuid,jsonb,date,boolean,text) from public,anon,authenticated;
grant execute on function public.assistant_load_options(uuid,uuid),public.assistant_confirm_load(uuid,uuid,uuid,uuid,jsonb,date,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
