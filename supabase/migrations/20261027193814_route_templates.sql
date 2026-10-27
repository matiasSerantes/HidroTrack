-- Prepared locally. Apply through authenticated MCP before enabling UI features.
begin;
create table public.route_templates(
 tenant_id uuid not null references public.tenants(id),
 id uuid not null, name text not null check(length(trim(name)) between 1 and 100),
 customer_ids uuid[] not null check(cardinality(customer_ids) between 1 and 500),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),source_trip_id uuid,
 primary key(tenant_id,id),foreign key(tenant_id,source_trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.route_templates enable row level security;
create policy route_templates_owner on public.route_templates for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.route_templates from public,anon,authenticated;
grant select on public.route_templates to authenticated;
create table private.route_creation_orders(tenant_id uuid not null,trip_id uuid not null,customer_ids uuid[] not null,primary key(tenant_id,trip_id),foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id));
revoke all on private.route_creation_orders from public,anon,authenticated;

create function public.owner_route_templates(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'customers',customer_ids) order by created_at desc,id) from public.route_templates where tenant_id=p_tenant),'[]'::jsonb);
end $$;
create function public.owner_save_route_template(p_tenant uuid,p_id uuid,p_name text,p_customers uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.route_templates;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 100 or p_customers is null or cardinality(p_customers) not between 1 and 500 then raise exception 'Nombre y clientes invalidos'; end if;
 select * into previous from public.route_templates where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.name=trim(p_name) and previous.customer_ids=p_customers and previous.created_by=auth.uid() then return p_id; end if;
  raise exception 'ID de plantilla ya utilizado';
 end if;
 if cardinality(p_customers)<>(select count(distinct c) from unnest(p_customers)c) or exists(select 1 from unnest(p_customers)c where not exists(select 1 from public.customers where tenant_id=p_tenant and id=c and active and not pending_recovery)) then raise exception 'Cliente no habilitado o repetido'; end if;
 if (select count(*) from public.route_templates where tenant_id=p_tenant)>=200 then raise exception 'Limite de 200 plantillas alcanzado'; end if;
 insert into public.route_templates(tenant_id,id,name,customer_ids,created_by) values(p_tenant,p_id,trim(p_name),p_customers,auth.uid());
 return p_id;
end $$;
create function public.owner_template_from_trip(p_tenant uuid,p_id uuid,p_trip uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare ids uuid[]; previous public.route_templates; result uuid;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.route_templates where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.source_trip_id=p_trip and previous.name=trim(p_name) and previous.created_by=auth.uid() then return p_id; end if;
  raise exception 'ID de plantilla ya utilizado';
 end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip) then raise exception 'Reparto no disponible'; end if;
 select array_agg(s.customer_id order by s.position,s.customer_id) into ids from public.route_stops s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id where s.tenant_id=p_tenant and s.trip_id=p_trip and s.active and c.active and not c.pending_recovery;
 result:=public.owner_save_route_template(p_tenant,p_id,p_name,ids);
 update public.route_templates set source_trip_id=p_trip where tenant_id=p_tenant and id=p_id;
 return result;
end $$;
create function public.owner_create_ordered_trip(p_tenant uuid,p_id uuid,p_driver uuid,p_name text,p_date date,p_customers uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare previous uuid[]; result uuid; existing public.inventory_trips;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if p_customers is null or cardinality(p_customers) not between 1 and 500 or cardinality(p_customers)<>(select count(distinct c) from unnest(p_customers)c) then raise exception 'Clientes invalidos o repetidos'; end if;
 select customer_ids into previous from private.route_creation_orders where tenant_id=p_tenant and trip_id=p_id;
 if found then
  if previous<>p_customers then raise exception 'ID de reparto ya utilizado con otro orden'; end if;
  select * into existing from public.inventory_trips where tenant_id=p_tenant and id=p_id;
  if existing.driver_id=p_driver and existing.name=p_name and existing.service_date=p_date then return p_id; end if;
  raise exception 'ID de reparto ya utilizado con otros datos';
 end if;
 if exists(select 1 from public.customers where tenant_id=p_tenant and id=any(p_customers) and pending_recovery) then raise exception 'Cliente pendiente de recuperacion'; end if;
 if exists(select 1 from public.inventory_trips where id=p_id) then raise exception 'Usa un nuevo ID para crear otro reparto'; end if;
 result:=public.inventory_create_trip(p_tenant,p_id,p_driver,p_name,p_date,p_customers);
 insert into private.route_creation_orders values(p_tenant,p_id,p_customers);
 update public.route_stops s set position=ordered.position::integer from unnest(p_customers) with ordinality as ordered(customer_id,position) where s.tenant_id=p_tenant and s.trip_id=p_id and s.customer_id=ordered.customer_id;
 return result;
end $$;
revoke all on function public.owner_route_templates(uuid),public.owner_save_route_template(uuid,uuid,text,uuid[]),public.owner_template_from_trip(uuid,uuid,uuid,text),public.owner_create_ordered_trip(uuid,uuid,uuid,text,date,uuid[]) from public,anon,authenticated;
grant execute on function public.owner_route_templates(uuid),public.owner_save_route_template(uuid,uuid,text,uuid[]),public.owner_template_from_trip(uuid,uuid,uuid,text),public.owner_create_ordered_trip(uuid,uuid,uuid,text,date,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
