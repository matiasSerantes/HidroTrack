begin;
alter table public.tenant_members add column promotion_allowed boolean not null default false;
create table public.promotions (
 tenant_id uuid not null references public.tenants(id), id uuid not null,
 author_id uuid not null, trip_id uuid,
 name text not null check(length(trim(name)) between 1 and 120),
 address text not null check(length(trim(address)) between 1 and 240),
 phone text not null check(length(phone)<=80),
 terms text not null check(length(trim(terms)) between 1 and 1000),
 started_on date not null, follow_up date not null check(follow_up>=started_on),
 status text not null default 'trial' check(status in ('trial','recovery','converted','closed')),
 customer_id uuid, delivered jsonb not null, created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,author_id) references public.tenant_members(tenant_id,user_id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 check((status='converted')=(customer_id is not null))
);
create index promotions_author on public.promotions(tenant_id,author_id,trip_id);
create index promotions_customer on public.promotions(tenant_id,customer_id);
create table public.promotion_events (
 tenant_id uuid not null references public.tenants(id), id uuid not null,
 promotion_id uuid, actor_id uuid not null, kind text not null check(kind in ('permission','offer','convert','reject','recover')),
 payload jsonb not null, occurred_on date not null, created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,promotion_id) references public.promotions(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.tenant_members(tenant_id,user_id),
 check((kind='permission')=(promotion_id is null))
);
create index promotion_events_promotion on public.promotion_events(tenant_id,promotion_id);
create index promotion_events_actor on public.promotion_events(tenant_id,actor_id);
create table public.promotion_notifications (
 tenant_id uuid not null, id uuid not null default gen_random_uuid(), promotion_id uuid not null, recipient_id uuid not null,
 created_at timestamptz not null default now(), read_at timestamptz,
 primary key(tenant_id,id), unique(tenant_id,promotion_id,recipient_id),
 foreign key(tenant_id,promotion_id) references public.promotions(tenant_id,id),
 foreign key(tenant_id,recipient_id) references public.tenant_members(tenant_id,user_id)
);
create index promotion_notifications_inbox on public.promotion_notifications(tenant_id,recipient_id,created_at);
alter table public.promotions enable row level security;
alter table public.promotion_events enable row level security;
alter table public.promotion_notifications enable row level security;
create function private.promotion_access(t uuid,p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(t,array['owner']) or (private.has_role(t,array['driver']) and exists(
 select 1 from public.promotions o join public.tenant_members m on m.tenant_id=o.tenant_id and m.user_id=o.author_id
 join public.inventory_trips r on r.tenant_id=o.tenant_id and r.id=o.trip_id
 where o.tenant_id=t and o.id=p and o.author_id=auth.uid() and m.promotion_allowed and r.driver_id=auth.uid() and r.status='active'));
$$;
revoke all on function private.promotion_access(uuid,uuid) from public,anon,authenticated;
grant execute on function private.promotion_access(uuid,uuid) to authenticated;
create policy promotions_read on public.promotions for select to authenticated using(private.promotion_access(tenant_id,id));
create policy promotion_events_read on public.promotion_events for select to authenticated using(private.has_role(tenant_id,array['owner']) or (kind<>'permission' and private.promotion_access(tenant_id,promotion_id)));
create policy promotion_notifications_read on public.promotion_notifications for select to authenticated using(recipient_id=auth.uid() and private.has_role(tenant_id,array['owner']));
revoke all on public.promotions,public.promotion_events,public.promotion_notifications from public,anon,authenticated;
grant select on public.promotions,public.promotion_events,public.promotion_notifications to authenticated;

-- Physical stock remains in the same immutable ledger, outside active customers.
alter table public.inventory_operations add column promotion_id uuid;
alter table public.inventory_operations add foreign key(tenant_id,promotion_id) references public.promotions(tenant_id,id);
create index inventory_operations_promotion on public.inventory_operations(tenant_id,promotion_id);
alter table public.inventory_movements add column promotion_held integer not null default 0, add column promotion_damaged integer not null default 0;
alter table public.inventory_movements drop constraint inventory_movements_check;
alter table public.inventory_movements add constraint inventory_movements_check check(depot_ready<>0 or truck_ready<>0 or depot_empty<>0 or truck_empty<>0 or customer_held<>0 or promotion_held<>0 or promotion_damaged<>0);
-- Extend existing guards without weakening previous operation scopes.
do $$ declare expr text; begin
 select pg_get_constraintdef(oid) into expr from pg_constraint where conrelid='public.inventory_operations'::regclass and conname='inventory_operation_scope';
 execute 'alter table public.inventory_operations drop constraint inventory_operation_scope';
 execute 'alter table public.inventory_operations add constraint inventory_operation_scope check (('||substring(expr from 8 for length(expr)-8)||') or (kind in (''promotion_offer'',''promotion_return'') and customer_id is null) or (kind=''promotion_convert'' and customer_id is not null and trip_id is null))';
end $$;
alter table public.inventory_operations drop constraint inventory_operations_kind_check;
alter table public.inventory_operations add constraint inventory_operations_kind_check check(kind in ('receive','load','delivery','close','receive_empty','refill','opening_customer','remove','damage','dispenser_assign','dispenser_return','promotion_offer','promotion_return','promotion_convert'));
alter table public.inventory_operations add constraint inventory_promotion_scope check((kind in ('promotion_offer','promotion_return','promotion_convert'))=(promotion_id is not null));
create or replace view public.inventory_owned_stock with(security_invoker=true) as
 select tenant_id,product_id,sum(depot_ready)::bigint as depot_ready,sum(depot_empty)::bigint as depot_empty,
 sum(truck_ready)::bigint as truck_ready,sum(truck_empty)::bigint as truck_empty,sum(customer_held)::bigint as in_customers,
 sum(depot_ready+depot_empty+truck_ready+truck_empty+customer_held+promotion_held+promotion_damaged)::bigint as total_owned,
 sum(promotion_held)::bigint as in_promotions,sum(promotion_damaged)::bigint as promotion_damaged
 from public.inventory_movements where private.has_role(tenant_id,array['owner']) group by tenant_id,product_id;

create function public.promotion_set_permission(p_tenant uuid,p_id uuid,p_user uuid,p_allowed boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare old_event public.promotion_events; payload jsonb:=jsonb_build_object('user_id',p_user,'allowed',p_allowed);
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede habilitar promociones' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into old_event from public.promotion_events where tenant_id=p_tenant and id=p_id;
 if found then
  if old_event.kind='permission' and old_event.actor_id=auth.uid() and old_event.payload=payload then return p_allowed; end if;
  raise exception 'ID de evento ya utilizado';
 end if;
 if p_allowed is null or not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=p_user and active and role='driver') then raise exception 'Asistente no vinculado'; end if;
 update public.tenant_members set promotion_allowed=p_allowed where tenant_id=p_tenant and user_id=p_user;
 insert into public.promotion_events(tenant_id,id,actor_id,kind,payload,occurred_on) values(p_tenant,p_id,auth.uid(),'permission',payload,(now() at time zone 'America/Argentina/Buenos_Aires')::date);
 return p_allowed;
end $$;
create function private.promotion_revoke_inactive() returns trigger language plpgsql set search_path='' as $$
begin if not new.active or new.role<>'driver' then new.promotion_allowed:=false; end if; return new; end $$;
create trigger promotion_revoke_inactive before update on public.tenant_members for each row execute function private.promotion_revoke_inactive();
revoke all on function private.promotion_revoke_inactive() from public,anon,authenticated;

create function public.promotion_offer(p_tenant uuid,p_id uuid,p_trip uuid,p_name text,p_address text,p_phone text,p_terms text,p_date date,p_follow_up date,p_items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare is_owner boolean; previous public.promotions; item jsonb; product public.products; q numeric; available bigint; seen uuid[]:='{}';
begin
 if not private.has_role(p_tenant,array['owner','driver']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 is_owner:=private.has_role(p_tenant,array['owner']);
 if not is_owner and not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=auth.uid() and promotion_allowed) then raise exception 'El jefe debe habilitar promociones' using errcode='42501'; end if;
 select * into previous from public.promotions where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.author_id=auth.uid() and previous.trip_id is not distinct from p_trip and previous.name=p_name and previous.address=p_address and previous.phone=p_phone and previous.terms=p_terms and previous.started_on=p_date and previous.follow_up=p_follow_up and previous.delivered=p_items then return p_id; end if;
  raise exception 'ID de promocion ya utilizado';
 end if;
 if is_owner and p_trip is not null then raise exception 'El jefe entrega desde deposito'; end if;
 if not is_owner and not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid() and status='active' and service_date=p_date) then raise exception 'Necesitas tu recorrido activo'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_follow_up is null or p_follow_up<p_date then raise exception 'Fecha invalida'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Articulos invalidos'; end if;
 insert into public.promotions(tenant_id,id,author_id,trip_id,name,address,phone,terms,started_on,follow_up,delivered) values(p_tenant,p_id,auth.uid(),p_trip,p_name,p_address,p_phone,p_terms,p_date,p_follow_up,p_items);
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,actor_id,items,occurred_on,promotion_id) values(p_tenant,p_id,'promotion_offer',p_trip,auth.uid(),p_items,p_date,p_id);
 for item in select value from jsonb_array_elements(p_items) loop
  q:=(item->>'quantity')::numeric;
  select * into product from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid and active and (returnable or family='dispenser');
  if not found or q is null or q not between 1 and 100000 or q<>trunc(q) or product.id=any(seen) then raise exception 'Articulo o cantidad invalida'; end if;
  seen:=array_append(seen,product.id);
  select coalesce(sum(case when p_trip is null then m.depot_ready else m.truck_ready end),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=product.id and (p_trip is null or o.trip_id=p_trip);
  if q>available then raise exception 'Stock insuficiente'; end if;
  insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,truck_ready,promotion_held,unit_price) values(p_tenant,p_id,product.id,case when p_trip is null then -q else 0 end,case when p_trip is null then 0 else -q end,q,product.price);
 end loop;
 insert into public.promotion_events(tenant_id,id,promotion_id,actor_id,kind,payload,occurred_on) values(p_tenant,p_id,p_id,auth.uid(),'offer',p_items,p_date);
 if not is_owner then insert into public.promotion_notifications(tenant_id,promotion_id,recipient_id) select p_tenant,p_id,user_id from public.tenant_members where tenant_id=p_tenant and role='owner'; end if;
 return p_id;
end $$;

create function public.promotion_resolve(p_tenant uuid,p_id uuid,p_promotion uuid,p_action text,p_date date,p_customer uuid default null,p_monthly jsonb default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare promo public.promotions; previous public.promotion_events; payload jsonb; row record; product public.products; monthly numeric; operation uuid; n integer;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe decide promociones' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('action',p_action,'customer_id',p_customer,'monthly',p_monthly);
 select * into previous from public.promotion_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.promotion_id=p_promotion and previous.actor_id=auth.uid() and previous.payload=payload and previous.occurred_on=p_date then return p_promotion; end if;
  raise exception 'ID de evento ya utilizado';
 end if;
 select * into promo from public.promotions where tenant_id=p_tenant and id=p_promotion;
 if not found or promo.status<>'trial' then raise exception 'Promocion no disponible'; end if;
 if p_date is null or p_date<promo.started_on or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha invalida'; end if;
 if p_action='reject' then
  if p_customer is not null then raise exception 'El rechazo no crea cliente'; end if;
  update public.promotions set status='recovery' where tenant_id=p_tenant and id=p_promotion;
 elsif p_action='convert' then
  if p_customer is null or p_monthly is null or jsonb_typeof(p_monthly)<>'object' then raise exception 'Cliente o cuotas invalidos'; end if;
  insert into public.customers(id,tenant_id,name,address,phone) values(p_customer,p_tenant,promo.name,promo.address,promo.phone);
  for row in select m.product_id,sum(m.promotion_held)::integer as q from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and o.promotion_id=p_promotion group by m.product_id having sum(m.promotion_held)>0 loop
   select * into product from public.products where tenant_id=p_tenant and id=row.product_id;
   monthly:=coalesce((p_monthly->>row.product_id::text)::numeric,0);
   if monthly<0 or monthly>999999999999.99 or monthly<>round(monthly,2) or monthly::text in ('NaN','Infinity','-Infinity') then raise exception 'Cuota invalida'; end if;
   for n in 1..(case when product.family='dispenser' then row.q else 1 end) loop
    operation:=gen_random_uuid();
    insert into public.inventory_operations(tenant_id,id,kind,customer_id,actor_id,items,occurred_on,promotion_id) values(p_tenant,operation,'promotion_convert',p_customer,auth.uid(),jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',case when product.family='dispenser' then 1 else row.q end)),p_date,p_promotion);
    insert into public.inventory_movements(tenant_id,operation_id,product_id,customer_held,promotion_held,unit_price) values(p_tenant,operation,product.id,case when product.family='dispenser' then 1 else row.q end,-(case when product.family='dispenser' then 1 else row.q end),product.price);
    if product.family='dispenser' then insert into public.dispenser_assignments(tenant_id,id,product_id,customer_id,mode,monthly,occurred_on,last_operation) values(p_tenant,operation,product.id,p_customer,case when monthly>0 then 'rental' else 'loan' end,monthly,p_date,operation); end if;
   end loop;
  end loop;
  update public.promotions set status='converted',customer_id=p_customer where tenant_id=p_tenant and id=p_promotion;
 else raise exception 'Decision invalida'; end if;
 insert into public.promotion_events(tenant_id,id,promotion_id,actor_id,kind,payload,occurred_on) values(p_tenant,p_id,p_promotion,auth.uid(),case when p_action='convert' then 'convert' else 'reject' end,payload,p_date);
 return p_promotion;
end $$;

create function public.promotion_recover(p_tenant uuid,p_id uuid,p_promotion uuid,p_date date,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare promo public.promotions; previous public.promotion_events; item jsonb; product public.products; good numeric; damaged numeric; available bigint; seen uuid[]:='{}';
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe registra recuperacion' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.promotion_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.kind='recover' and previous.promotion_id=p_promotion and previous.actor_id=auth.uid() and previous.payload=p_items and previous.occurred_on=p_date then return p_promotion; end if;
  raise exception 'ID de evento ya utilizado';
 end if;
 select * into promo from public.promotions where tenant_id=p_tenant and id=p_promotion;
 if not found or promo.status<>'recovery' then raise exception 'Promocion no pendiente de recuperacion'; end if;
 if p_date is null or p_date<promo.started_on or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha invalida'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Devoluciones invalidas'; end if;
 insert into public.inventory_operations(tenant_id,id,kind,actor_id,items,occurred_on,promotion_id) values(p_tenant,p_id,'promotion_return',auth.uid(),p_items,p_date,p_promotion);
 for item in select value from jsonb_array_elements(p_items) loop
  good:=(item->>'good')::numeric;damaged:=(item->>'damaged')::numeric;
  select * into product from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid;
  if not found or good is null or damaged is null or good<0 or damaged<0 or good+damaged not between 1 and 100000 or good<>trunc(good) or damaged<>trunc(damaged) or product.id=any(seen) then raise exception 'Devolucion invalida'; end if;
  seen:=array_append(seen,product.id);
  select coalesce(sum(m.promotion_held),0) into available from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=product.id and o.promotion_id=p_promotion;
  if good+damaged>available then raise exception 'Devuelve mas de lo pendiente'; end if;
  insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,promotion_held,promotion_damaged,unit_price) values(p_tenant,p_id,product.id,case when product.family='dispenser' then good else 0 end,case when product.family='dispenser' then 0 else good end,-good-damaged,damaged,product.price);
 end loop;
 if not exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and o.promotion_id=p_promotion group by m.product_id having sum(m.promotion_held)>0) then update public.promotions set status='closed' where tenant_id=p_tenant and id=p_promotion; end if;
 insert into public.promotion_events(tenant_id,id,promotion_id,actor_id,kind,payload,occurred_on) values(p_tenant,p_id,p_promotion,auth.uid(),'recover',p_items,p_date);
 return p_promotion;
end $$;
create function public.promotion_read_notification(p_tenant uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 update public.promotion_notifications set read_at=coalesce(read_at,now()) where tenant_id=p_tenant and id=p_id and recipient_id=auth.uid();
end $$;
create function private.promotion_product_archive_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.active and not new.active then
  perform 1 from public.tenants where id=old.tenant_id for update;
  if exists(select 1 from public.inventory_movements where tenant_id=old.tenant_id and product_id=old.id group by product_id having sum(promotion_held)<>0 or sum(promotion_damaged)<>0) then raise exception 'Articulo con promociones pendientes o danos por resolver'; end if;
 end if;return new;
end $$;
create trigger promotion_product_archive_guard before update on public.products for each row execute function private.promotion_product_archive_guard();
revoke all on function private.promotion_product_archive_guard() from public,anon,authenticated;
revoke all on function public.promotion_set_permission(uuid,uuid,uuid,boolean),public.promotion_offer(uuid,uuid,uuid,text,text,text,text,date,date,jsonb),public.promotion_resolve(uuid,uuid,uuid,text,date,uuid,jsonb),public.promotion_recover(uuid,uuid,uuid,date,jsonb),public.promotion_read_notification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.promotion_set_permission(uuid,uuid,uuid,boolean),public.promotion_offer(uuid,uuid,uuid,text,text,text,text,date,date,jsonb),public.promotion_resolve(uuid,uuid,uuid,text,date,uuid,jsonb),public.promotion_recover(uuid,uuid,uuid,date,jsonb),public.promotion_read_notification(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
