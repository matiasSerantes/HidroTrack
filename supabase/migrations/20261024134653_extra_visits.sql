begin;
create table public.extra_visit_requests(
 id uuid primary key,
 tenant_id uuid not null references public.tenants(id),
 customer_id uuid not null,
 requested_on date not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 200),
 note text not null default '' check(length(note)<=400),
 actor_id uuid not null references auth.users(id),
 state text not null default 'pending' check(state in ('pending','assigned','cancelled')),
 trip_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 check((state='pending' and trip_id is null) or state<>'pending'),
 check(state<>'assigned' or trip_id is not null)
);
create unique index extra_visit_one_day on public.extra_visit_requests(tenant_id,customer_id,requested_on) where state<>'cancelled';
create index extra_visit_trip on public.extra_visit_requests(tenant_id,trip_id) where state='assigned';
create table public.extra_visit_events(
 id uuid primary key,
 tenant_id uuid not null,
 visit_id uuid not null,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('created','assigned','cancelled')),
 trip_id uuid,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,visit_id) references public.extra_visit_requests(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.extra_visit_requests enable row level security;
alter table public.extra_visit_events enable row level security;
revoke all on public.extra_visit_requests,public.extra_visit_events from public,anon,authenticated;
grant select on public.extra_visit_requests,public.extra_visit_events to authenticated;
create policy extra_visits_owner on public.extra_visit_requests for select to authenticated using(private.has_role(tenant_id,array['owner']));
create policy extra_visit_events_owner on public.extra_visit_events for select to authenticated using(private.has_role(tenant_id,array['owner']));

create function public.owner_request_extra_visit(p_tenant uuid,p_id uuid,p_customer uuid,p_date date,p_items jsonb,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.extra_visit_requests; item jsonb; q numeric; product uuid; seen uuid[]:='{}';
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_id is null or p_date is null or p_note is null or length(p_note)>400 then raise exception 'Solicitud invalida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.extra_visit_requests where id=p_id;
 if found then
  if previous.tenant_id=p_tenant and previous.customer_id=p_customer and previous.requested_on=p_date and previous.items=p_items and previous.note=p_note and previous.actor_id=auth.uid() then return p_id; end if;
  raise exception 'ID reutilizado con otros datos';
 end if;
 if p_date<(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Elegi una fecha de hoy en adelante'; end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active and not pending_recovery) then raise exception 'Cliente inactivo o pendiente de recuperacion'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Indica productos y cantidades'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  product:=(item->>'product_id')::uuid;q:=(item->>'quantity')::numeric;
  if product is null or q is null or q<>trunc(q) or q not between 1 and 100000 or product=any(seen) or not exists(select 1 from public.products where tenant_id=p_tenant and id=product and active) then raise exception 'Producto o cantidad invalida'; end if;
  seen:=array_append(seen,product);
 end loop;
 if exists(select 1 from public.extra_visit_requests where tenant_id=p_tenant and customer_id=p_customer and requested_on=p_date and state<>'cancelled') then raise exception 'Ya hay una visita extraordinaria para ese cliente y fecha'; end if;
 insert into public.extra_visit_requests(id,tenant_id,customer_id,requested_on,items,note,actor_id) values(p_id,p_tenant,p_customer,p_date,p_items,p_note,auth.uid());
 insert into public.extra_visit_events(id,tenant_id,visit_id,actor_id,action) values(p_id,p_tenant,p_id,auth.uid(),'created');
 return p_id;
end $$;

create function public.owner_manage_extra_visit(p_tenant uuid,p_id uuid,p_visit uuid,p_action text,p_trip uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.extra_visit_requests; e public.extra_visit_events; t public.inventory_trips; stop public.route_stops; pos integer;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_id is null or p_action is null or p_action not in ('assigned','cancelled') or (p_action='assigned' and p_trip is null) or (p_action='cancelled' and p_trip is not null) then raise exception 'Accion invalida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 perform 1 from public.tenants where id=p_tenant for update;
 select * into e from public.extra_visit_events where id=p_id;
 if found then
  if e.tenant_id=p_tenant and e.visit_id=p_visit and e.actor_id=auth.uid() and e.action=p_action and e.trip_id is not distinct from p_trip then return p_visit; end if;
  raise exception 'ID reutilizado con otros datos';
 end if;
 select * into v from public.extra_visit_requests where tenant_id=p_tenant and id=p_visit for update;
 if not found then raise exception 'Visita no disponible'; end if;
 if p_action='assigned' then
  if v.state<>'pending' then raise exception 'La visita ya no esta pendiente'; end if;
  if not exists(select 1 from public.customers where tenant_id=p_tenant and id=v.customer_id and active and not pending_recovery) then raise exception 'Cliente inactivo o pendiente de recuperacion'; end if;
  if exists(select 1 from jsonb_array_elements(v.items) i where not exists(select 1 from public.products where tenant_id=p_tenant and id=(i->>'product_id')::uuid and active)) then raise exception 'Un producto del pedido ya no esta activo'; end if;
  select * into t from public.inventory_trips where tenant_id=p_tenant and id=p_trip for update;
  if not found or t.status not in ('planned','active') or t.service_date<>v.requested_on then raise exception 'Elegi un reparto abierto de la fecha solicitada'; end if;
  select * into stop from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=v.customer_id;
  if found and stop.outcome in ('delivered','no_purchase') then raise exception 'La parada ya fue resuelta; elegi otro reparto'; end if;
  if stop.customer_id is null or not stop.active then
   select coalesce(max(position),0)+1 into pos from public.route_stops where tenant_id=p_tenant and trip_id=p_trip;
   perform public.route_edit_stop(p_tenant,p_id,p_trip,v.customer_id,pos,true,case when stop.customer_id is null then null else stop.version end);
  end if;
  update public.extra_visit_requests set state='assigned',trip_id=p_trip,updated_at=now() where id=p_visit;
 else
  if v.state='cancelled' then return p_visit; end if;
  -- Preserve the route stop, load and historical request. Cancel only the order.
  update public.extra_visit_requests set state='cancelled',updated_at=now() where id=p_visit;
 end if;
 insert into public.extra_visit_events(id,tenant_id,visit_id,actor_id,action,trip_id) values(p_id,p_tenant,p_visit,auth.uid(),p_action,p_trip);
 return p_visit;
end $$;
revoke all on function public.owner_request_extra_visit(uuid,uuid,uuid,date,jsonb,text),public.owner_manage_extra_visit(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.owner_request_extra_visit(uuid,uuid,uuid,date,jsonb,text),public.owner_manage_extra_visit(uuid,uuid,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
