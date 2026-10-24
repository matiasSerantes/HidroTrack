begin;
create table public.filling_cost_settings (
 tenant_id uuid primary key references public.tenants(id),
 enabled boolean not null default false,
 costs jsonb not null default '[]' check(jsonb_typeof(costs)='array'),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.filling_cost_settings enable row level security;
create policy filling_cost_settings_read on public.filling_cost_settings for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.filling_cost_settings from public,anon,authenticated;
grant select on public.filling_cost_settings to authenticated;

create function public.owner_set_filling_costs(p_tenant uuid,p_enabled boolean,p_costs jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb; amount numeric; product uuid; seen uuid[]:='{}';
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede configurar costos' using errcode='42501'; end if;
 if p_enabled is null or p_costs is null or jsonb_typeof(p_costs)<>'array' or jsonb_array_length(p_costs)>200 then raise exception 'Configuracion invalida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 for item in select value from jsonb_array_elements(p_costs) loop
  product:=(item->>'product_id')::uuid;amount:=(item->>'unit_cost')::numeric;
  if product is null or product=any(seen) or amount is null or amount<0 or amount>100000000 or amount<>round(amount,2) then raise exception 'Costo o producto invalido'; end if;
  if not exists(select 1 from public.products where tenant_id=p_tenant and id=product and active and returnable and family='article') then raise exception 'Costo solo para productos retornables activos'; end if;
  seen:=array_append(seen,product);
 end loop;
 insert into public.filling_cost_settings(tenant_id,enabled,costs,updated_by) values(p_tenant,p_enabled,p_costs,auth.uid())
 on conflict(tenant_id) do update set enabled=excluded.enabled,costs=excluded.costs,updated_by=excluded.updated_by,updated_at=now();
end $$;
revoke all on function public.owner_set_filling_costs(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.owner_set_filling_costs(uuid,boolean,jsonb) to authenticated;

create table public.inventory_load_snapshots (
 tenant_id uuid not null,
 id uuid not null,
 trip_id uuid not null,
 trip_name text not null,
 actor_id uuid not null references auth.users(id),
 occurred_on date not null,
 request_items jsonb not null,
 requested_refill_id uuid not null,
 fill_empties boolean not null,
 note text not null,
 items jsonb not null,
 cost_enabled boolean not null,
 filling_total numeric(18,2) not null check(filling_total>=0),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 unique(tenant_id,trip_id),
 foreign key(tenant_id,id) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.inventory_load_snapshots enable row level security;
create policy inventory_load_snapshots_read on public.inventory_load_snapshots for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.inventory_load_snapshots from public,anon,authenticated;
grant select on public.inventory_load_snapshots to authenticated;

create function public.inventory_confirm_load(p_tenant uuid,p_id uuid,p_refill_id uuid,p_trip uuid,p_items jsonb,p_date date,p_fill boolean,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.inventory_load_snapshots; settings public.filling_cost_settings; details jsonb; filled jsonb:='[]'; total numeric:=0; trip_name text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede confirmar la carga' using errcode='42501'; end if;
 if p_fill is null or p_refill_id is null or p_refill_id=p_id then raise exception 'Identificadores de carga invalidos'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.inventory_load_snapshots where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.request_items=p_items and previous.occurred_on=p_date and previous.requested_refill_id=p_refill_id and previous.fill_empties=p_fill and previous.note=p_note then return p_id; end if;
  raise exception 'ID de carga utilizado con otros datos';
 end if;
 if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id=p_id) then raise exception 'Carga anterior sin detalle historico; no se reconstruye'; end if;
 select name into trip_name from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='planned';
 if not found then raise exception 'Carga ya confirmada o reparto no preparado'; end if;
 select * into settings from public.filling_cost_settings where tenant_id=p_tenant;
 if p_fill then
  perform public.inventory_fill_and_load(p_tenant,p_id,p_refill_id,p_trip,p_items,p_date,p_note);
  select refill_items into filled from public.inventory_load_preparations where tenant_id=p_tenant and id=p_id;
 else
  perform public.inventory_record_stock(p_tenant,p_id,'load',p_trip,null,p_items,p_note,p_date);
 end if;
 -- The recommendation is computed in the database. A browser cannot submit
 -- invented suggestions or prices. Extraordinary orders replace habitual lines.
 with eligible as (
  select distinct c.id from public.route_stops s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id
  where s.tenant_id=p_tenant and s.trip_id=p_trip and s.active and c.active and not c.pending_recovery
 ), orders as (
  select h.product_id,h.quantity::numeric quantity from public.customer_product_preferences h join eligible c on c.id=h.customer_id
  where h.tenant_id=p_tenant and not exists(select 1 from public.extra_visit_requests e where e.tenant_id=p_tenant and e.trip_id=p_trip and e.customer_id=c.id and e.state='assigned')
  union all
  select (i->>'product_id')::uuid,(i->>'quantity')::numeric from public.extra_visit_requests e join eligible c on c.id=e.customer_id
  cross join lateral jsonb_array_elements(e.items) i where e.tenant_id=p_tenant and e.trip_id=p_trip and e.state='assigned'
 ), suggested as (select product_id,sum(quantity) quantity from orders group by product_id),
 loaded as (select (i->>'product_id')::uuid product_id,(i->>'quantity')::numeric quantity from jsonb_array_elements(p_items) i),
 refilled as (select (i->>'product_id')::uuid product_id,(i->>'quantity')::numeric quantity from jsonb_array_elements(filled) i),
 costs as (select (i->>'product_id')::uuid product_id,(i->>'unit_cost')::numeric unit_cost from jsonb_array_elements(coalesce(settings.costs,'[]')) i),
 lines as (
  select p.id,p.name,p.unit,coalesce(s.quantity,0) suggested,coalesce(l.quantity,0) loaded,coalesce(r.quantity,0) refilled,
   case when coalesce(settings.enabled,false) and p.returnable and p.family='article' then c.unit_cost else null end unit_cost
  from public.products p left join suggested s on s.product_id=p.id left join loaded l on l.product_id=p.id
  left join refilled r on r.product_id=p.id left join costs c on c.product_id=p.id
  where p.tenant_id=p_tenant and p.active and (l.product_id is not null or s.product_id is not null)
 )
 select coalesce(jsonb_agg(jsonb_build_object('product_id',id,'name',name,'unit',unit,'suggested',suggested,'loaded',loaded,'extra',greatest(loaded-suggested,0),'missing',greatest(suggested-loaded,0),'refilled',refilled,'unit_cost',unit_cost,'filling_cost',case when unit_cost is null then null else refilled*unit_cost end) order by name,id),'[]'),coalesce(sum(refilled*unit_cost),0)
 into details,total from lines;
 insert into public.inventory_load_snapshots(tenant_id,id,trip_id,trip_name,actor_id,occurred_on,request_items,requested_refill_id,fill_empties,note,items,cost_enabled,filling_total)
 values(p_tenant,p_id,p_trip,trip_name,auth.uid(),p_date,p_items,p_refill_id,p_fill,p_note,details,coalesce(settings.enabled,false),total);
 return p_id;
end $$;
revoke all on function public.inventory_confirm_load(uuid,uuid,uuid,uuid,jsonb,date,boolean,text) from public,anon,authenticated;
grant execute on function public.inventory_confirm_load(uuid,uuid,uuid,uuid,jsonb,date,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
