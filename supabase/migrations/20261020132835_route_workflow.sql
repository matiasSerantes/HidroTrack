begin;
alter table public.customers
 add column pending_recovery boolean not null default false,
 add column locality text not null default '' check(length(locality)<=120),
 add column street text not null default '' check(length(street)<=160),
 add column street_number integer check(street_number>=0),
 add column latitude double precision,
 add column longitude double precision,
 add constraint customer_coordinates check((latitude is null and longitude is null) or
 (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180));
alter table public.tenants add column logo_url text check(logo_url is null or (length(logo_url)<=1000 and logo_url like 'https://%'));
create table public.route_stops (
 tenant_id uuid not null,
 trip_id uuid not null,
 customer_id uuid not null,
 position integer not null check(position between 1 and 100000),
 active boolean not null default true,
 outcome text not null default 'pending' check(outcome in ('pending','present','absent','no_purchase','delivered')),
 followup text check(followup in ('later_today','date')),
 next_date date,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key(tenant_id,trip_id,customer_id),
 foreign key(tenant_id,trip_id,customer_id) references public.inventory_trip_customers(tenant_id,trip_id,customer_id),
 check((outcome='absent' and followup is not null and next_date is not null) or
 (outcome<>'absent' and followup is null and next_date is null))
);
create index route_stops_order on public.route_stops(tenant_id,trip_id,position,customer_id);
create index route_stops_pending on public.route_stops(tenant_id,next_date) where outcome='absent' and active;
create table public.route_events (
 tenant_id uuid not null,
 id uuid not null,
 trip_id uuid not null,
 customer_id uuid not null,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('present','absent','no_purchase','delivered','edit_stop')),
 data jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,trip_id,customer_id) references public.route_stops(tenant_id,trip_id,customer_id)
);
create table public.driver_positions (
 tenant_id uuid not null,
 user_id uuid not null,
 trip_id uuid not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy double precision not null check(accuracy between 0 and 100000),
 updated_at timestamptz not null default now(),
 primary key(tenant_id,user_id),
 foreign key(tenant_id,user_id) references public.tenant_members(tenant_id,user_id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.route_stops enable row level security;
alter table public.route_events enable row level security;
alter table public.driver_positions enable row level security;
create policy route_stops_read on public.route_stops for select to authenticated using(private.inventory_trip_access(tenant_id,trip_id));
create policy route_events_read on public.route_events for select to authenticated using(private.inventory_trip_access(tenant_id,trip_id));
create policy driver_positions_read on public.driver_positions for select to authenticated using(private.has_role(tenant_id,array['owner']) or (user_id=auth.uid() and private.has_role(tenant_id,array['driver'])));
revoke all on public.route_stops,public.route_events,public.driver_positions from public,anon,authenticated;
grant select on public.route_stops,public.route_events,public.driver_positions to authenticated;

create function private.route_new_stop() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=new.tenant_id for update;
 insert into public.route_stops(tenant_id,trip_id,customer_id,position)
 select new.tenant_id,new.trip_id,new.customer_id,coalesce(max(position),0)+1 from public.route_stops where tenant_id=new.tenant_id and trip_id=new.trip_id;
 return new;
end $$;
create trigger route_new_stop after insert on public.inventory_trip_customers for each row execute function private.route_new_stop();
revoke all on function private.route_new_stop() from public,anon,authenticated;
insert into public.route_stops(tenant_id,trip_id,customer_id,position)
select tenant_id,trip_id,customer_id,row_number() over(partition by tenant_id,trip_id order by customer_id)::integer from public.inventory_trip_customers;
update public.route_stops r set outcome='delivered' where exists(select 1 from public.inventory_operations o where o.tenant_id=r.tenant_id and o.trip_id=r.trip_id and o.customer_id=r.customer_id and o.kind='delivery');

create function public.route_edit_stop(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_position integer,p_active boolean,p_version integer default null) returns integer
language plpgsql security definer set search_path='' as $$
declare s public.route_stops; previous public.route_events; payload jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede modificar paradas' using errcode='42501'; end if;
 if p_position is null or p_position not between 1 and 100000 or p_active is null then raise exception 'Parada inválida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('position',p_position,'active',p_active,'expected_version',p_version);
 select * into previous from public.route_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.customer_id=p_customer and previous.action='edit_stop' and previous.data-'result_version'=payload then return (previous.data->>'result_version')::integer; end if;
  raise exception 'ID de visita ya utilizado';
 end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status in ('planned','active')) then raise exception 'Reparto no editable'; end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no habilitado'; end if;
 select * into s from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer;
 if not found then
  if p_version is not null or not p_active then raise exception 'Parada no encontrada'; end if;
  insert into public.inventory_trip_customers values(p_tenant,p_trip,p_customer);
  select * into s from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer;
 elsif p_version is null or s.version<>p_version then raise exception 'La parada cambió; actualizá el reparto';
 end if;
 if s.outcome in ('delivered','no_purchase') then raise exception 'La visita resuelta conserva su historial'; end if;
 update public.route_stops set position=p_position,active=p_active,version=version+1,updated_at=now() where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer returning * into s;
 insert into public.route_events values(p_tenant,p_id,p_trip,p_customer,auth.uid(),'edit_stop',payload||jsonb_build_object('result_version',s.version),now());
 return s.version;
end $$;

create function public.route_record_visit(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_outcome text,p_version integer,p_followup text default null,p_next_date date default null,p_note text default '') returns integer
language plpgsql security definer set search_path='' as $$
declare s public.route_stops; previous public.route_events; payload jsonb; service_date date;
begin
 if not private.inventory_trip_access(p_tenant,p_trip) then raise exception 'Reparto no asignado' using errcode='42501'; end if;
 if p_outcome is null or p_outcome not in ('present','absent','no_purchase') or p_note is null or length(p_note)>400 or p_version is null then raise exception 'Visita inválida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('outcome',p_outcome,'expected_version',p_version,'followup',p_followup,'next_date',p_next_date,'note',p_note);
 select * into previous from public.route_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.customer_id=p_customer and previous.action=p_outcome and previous.data-'result_version'=payload then return (previous.data->>'result_version')::integer; end if;
  raise exception 'ID de visita ya utilizado';
 end if;
 select t.service_date into service_date from public.inventory_trips t where tenant_id=p_tenant and id=p_trip and status='active';
 if not found then raise exception 'Reparto no activo'; end if;
 if p_outcome='absent' then
  if p_followup is null or p_followup not in ('later_today','date') or p_next_date is null or p_next_date<service_date or (p_followup='later_today' and p_next_date<>service_date) then raise exception 'Elegí cuándo volver'; end if;
 elsif p_followup is not null or p_next_date is not null then raise exception 'Reprogramación solo para ausencias'; end if;
 select * into s from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer and active;
 if not found or not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no habilitado en esta parada'; end if;
 if s.version<>p_version then raise exception 'La parada cambió; actualizá el reparto'; end if;
 if s.outcome in ('delivered','no_purchase') then raise exception 'La visita ya está resuelta'; end if;
 update public.route_stops set outcome=p_outcome,followup=p_followup,next_date=p_next_date,version=version+1,updated_at=now() where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer returning * into s;
 insert into public.route_events values(p_tenant,p_id,p_trip,p_customer,auth.uid(),p_outcome,payload||jsonb_build_object('result_version',s.version),now());
 return s.version;
end $$;

-- A second confirmed delivery cannot silently visit the same stop twice.
create function private.route_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='delivery' then
  update public.route_stops set outcome='delivered',followup=null,next_date=null,version=version+1,updated_at=now()
  where tenant_id=new.tenant_id and trip_id=new.trip_id and customer_id=new.customer_id and active and outcome not in ('delivered','no_purchase');
  if not found then raise exception 'Parada retirada o visita ya resuelta'; end if;
  insert into public.route_events values(new.tenant_id,new.id,new.trip_id,new.customer_id,new.actor_id,'delivered',jsonb_build_object('operation_id',new.id),now());
 end if;
 return new;
end $$;
create trigger route_delivery after insert on public.inventory_operations for each row execute function private.route_delivery();
revoke all on function private.route_delivery() from public,anon,authenticated;

create function public.route_publish_position(p_tenant uuid,p_trip uuid,p_latitude double precision,p_longitude double precision,p_accuracy double precision) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner','driver']) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid() and status='active') then raise exception 'Solo el repartidor de un reparto activo puede publicar ubicación' using errcode='42501'; end if;
 insert into public.driver_positions(tenant_id,user_id,trip_id,latitude,longitude,accuracy) values(p_tenant,auth.uid(),p_trip,p_latitude,p_longitude,p_accuracy)
 on conflict(tenant_id,user_id) do update set trip_id=excluded.trip_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=now();
end $$;
create function public.route_stop_position(p_tenant uuid) returns void
language plpgsql security definer set search_path='' as $$
begin delete from public.driver_positions where tenant_id=p_tenant and user_id=auth.uid(); end $$;

-- Full customer balances, not a misleading partial sum of the driver's old routes.
create function public.route_manifest(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.inventory_trip_access(p_tenant,p_trip) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip) then raise exception 'Reparto no asignado' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
 'customer_id',c.id,'name',c.name,'address',c.address,'phone',c.phone,'locality',c.locality,'street',c.street,'street_number',c.street_number,'latitude',c.latitude,'longitude',c.longitude,
 'position',r.position,'version',r.version,'active',r.active and c.active,'outcome',r.outcome,'followup',r.followup,'next_date',r.next_date,
 'balance',coalesce((select sum(s.total-coalesce((select sum(p.amount) from public.payments p where p.tenant_id=s.tenant_id and p.sale_id=s.id),0)) from public.sales s where s.tenant_id=c.tenant_id and s.customer_id=c.id),0),
 'containers',coalesce((select jsonb_agg(to_jsonb(v)) from (select m.product_id,sum(m.customer_held) quantity from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=c.tenant_id and o.customer_id=c.id group by m.product_id having sum(m.customer_held)>0) v),'[]'::jsonb),
 'pending_recovery',c.pending_recovery,
 'dispensers',coalesce((select jsonb_agg(to_jsonb(a)) from public.dispenser_assignments a where a.tenant_id=c.tenant_id and a.customer_id=c.id and a.status='active'),'[]'::jsonb),
 'equipment',coalesce((select jsonb_agg(to_jsonb(a)) from public.dispensers a where a.tenant_id=c.tenant_id and a.customer_id=c.id and not a.retired),'[]'::jsonb)
 ) order by r.position,c.id),'[]'::jsonb) from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id where r.tenant_id=p_tenant and r.trip_id=p_trip and (c.active or private.has_role(p_tenant,array['owner'])));
end $$;
revoke all on function public.route_edit_stop(uuid,uuid,uuid,uuid,integer,boolean,integer),public.route_record_visit(uuid,uuid,uuid,uuid,text,integer,text,date,text),public.route_publish_position(uuid,uuid,double precision,double precision,double precision),public.route_stop_position(uuid),public.route_manifest(uuid,uuid) from public,anon,authenticated;
grant execute on function public.route_edit_stop(uuid,uuid,uuid,uuid,integer,boolean,integer),public.route_record_visit(uuid,uuid,uuid,uuid,text,integer,text,date,text),public.route_publish_position(uuid,uuid,double precision,double precision,double precision),public.route_stop_position(uuid),public.route_manifest(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
