begin;
alter table public.license_plan_catalog
 add column customer_limit integer check(customer_limit>0),
 add column driver_limit integer check(driver_limit>0),
 add column article_limit integer check(article_limit>0),
 add column dispenser_limit integer check(dispenser_limit>0),
 add column active_trip_limit integer check(active_trip_limit>0),
 add column planned_trip_limit integer check(planned_trip_limit>0),
 add column promotion_limit integer check(promotion_limit>0);
update public.license_plan_catalog set customer_limit=100,driver_limit=1,article_limit=3,dispenser_limit=3,active_trip_limit=1,planned_trip_limit=5,promotion_limit=2,updated_at=now() where plan='basic';
update public.license_plan_catalog set customer_limit=300,driver_limit=4,article_limit=6,dispenser_limit=6,active_trip_limit=3,planned_trip_limit=15,promotion_limit=6,updated_at=now() where plan='intermediate';
create function private.plan_limits(p text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('clients',customer_limit,'drivers',driver_limit,'articles',article_limit,'dispensers',dispenser_limit,'active_trips',active_trip_limit,'planned_trips',planned_trip_limit,'promotions',promotion_limit) from public.license_plan_catalog where plan=p;
$$;
create function private.plan_usage(t uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'clients',(select count(*) from public.customers where tenant_id=t and active and removed_at is null),
 'drivers',(select count(*) from public.tenant_members where tenant_id=t and active and role='driver'),
 'articles',(select count(*) from public.products where tenant_id=t and active and family='article'),
 'dispensers',(select count(*) from public.products where tenant_id=t and active and family='dispenser'),
 'active_trips',(select count(*) from public.inventory_trips where tenant_id=t and removed_at is null and status in ('active','submitted')),
 'planned_trips',(select count(*) from public.inventory_trips where tenant_id=t and removed_at is null and status='planned'),
 'promotions',(select count(*) from public.sale_combos where tenant_id=t and active));
$$;
revoke all on function private.plan_limits(text),private.plan_usage(uuid) from public,anon,authenticated;
create or replace function private.normalize_driver_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare limits jsonb;usage jsonb;entry record;check_capacity boolean;begin
 perform 1 from public.tenants where id=new.tenant_id for update;
 limits:=private.plan_limits(new.driver_plan);
 if new.driver_plan='unlimited' then new.driver_limit:=0;
 elsif new.driver_plan in ('basic','intermediate') then new.driver_limit:=(limits->>'drivers')::integer;end if;
 check_capacity:=tg_op='INSERT';
 if tg_op='UPDATE' then check_capacity:=(new.driver_plan,new.driver_limit) is distinct from (old.driver_plan,old.driver_limit);end if;
 if check_capacity then
  usage:=private.plan_usage(new.tenant_id);
  if new.driver_plan<>'unlimited' and (usage->>'drivers')::integer>new.driver_limit then raise exception 'El limite es menor que los choferes vinculados';end if;
  for entry in select key,value from jsonb_each(limits) loop
   if entry.value<>'null'::jsonb and (usage->>entry.key)::bigint>(entry.value::text)::integer then raise exception 'La cuenta supera el cupo de % del plan; libera lugares antes de cambiar de licencia',case entry.key when 'active_trips' then 'repartos abiertos' when 'planned_trips' then 'repartos preparados' when 'clients' then 'clientes' when 'articles' then 'modelos de productos' when 'dispensers' then 'modelos de dispenser' else entry.key end;end if;
  end loop;
  if new.driver_plan='custom' and exists(select 1 from public.inventory_trips where tenant_id=new.tenant_id and removed_at is null and status in ('active','submitted') group by driver_id having count(*)>1) then raise exception 'Primero cierra los repartos abiertos adicionales antes de cambiar de plan';end if;
 end if;
 return new;
end $$;
-- Existing intermediate licences gain the agreed fourth driver; no data is removed.
update public.licenses set driver_limit=4 where driver_plan='intermediate';
create function private.enforce_resource_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare plan text;limits jsonb;bucket text;cap integer;used bigint;begin
 if tg_op='UPDATE' and (new.tenant_id<>old.tenant_id or new.id<>old.id) then raise exception 'La identidad del registro es inmutable';end if;
 perform 1 from public.tenants where id=new.tenant_id for update;
 select driver_plan into plan from public.licenses where tenant_id=new.tenant_id;
 limits:=private.plan_limits(plan);
 if limits is null or plan='unlimited' then return new;end if;
 if tg_table_name='customers' then
  if not new.active or new.removed_at is not null then return new;end if;
  if tg_op='UPDATE' then if old.active and old.removed_at is null then return new;end if;end if;
  bucket:='clients';select count(*) into used from public.customers where tenant_id=new.tenant_id and active and removed_at is null and id<>new.id;
 elsif tg_table_name='products' then
  if not new.active then return new;end if;
  if tg_op='UPDATE' then if old.active and old.family=new.family then return new;end if;end if;
  bucket:=case when new.family='dispenser' then 'dispensers' else 'articles' end;
  select count(*) into used from public.products where tenant_id=new.tenant_id and active and family=new.family and id<>new.id;
 elsif tg_table_name='sale_combos' then
  if not new.active then return new;end if;
  if tg_op='UPDATE' then if old.active then return new;end if;end if;
  bucket:='promotions';select count(*) into used from public.sale_combos where tenant_id=new.tenant_id and active and id<>new.id;
 end if;
 cap:=(limits->>bucket)::integer;
 if cap is not null and used>=cap then
  raise exception 'Cupo del plan alcanzado: % (maximo %). Desactiva un registro o cambia de plan',case bucket when 'clients' then 'clientes activos' when 'articles' then 'modelos de productos' when 'dispensers' then 'modelos de dispenser' else 'promociones activas' end,cap;
 end if;
 return new;
end $$;
revoke all on function private.enforce_resource_plan() from public,anon,authenticated;
create trigger zz_license_customer_limit before insert or update on public.customers for each row execute function private.enforce_resource_plan();
-- Alphabetically after family inference for legacy callers.
create trigger zz_license_product_limit before insert or update on public.products for each row execute function private.enforce_resource_plan();
create trigger zz_license_combo_limit before insert or update on public.sale_combos for each row execute function private.enforce_resource_plan();
create or replace function private.enforce_open_trip_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare plan text;limits jsonb;bucket text;old_bucket text;cap integer;used bigint;begin
 if tg_op='UPDATE' and (new.tenant_id<>old.tenant_id or new.id<>old.id) then raise exception 'La identidad del reparto es inmutable';end if;
 perform 1 from public.tenants where id=new.tenant_id for update;
 select driver_plan into plan from public.licenses where tenant_id=new.tenant_id;
 if new.removed_at is not null or new.status='closed' or plan='unlimited' then return new;end if;
 if plan='custom' then
  if new.status in ('active','submitted') and exists(select 1 from public.inventory_trips where tenant_id=new.tenant_id and driver_id=new.driver_id and id<>new.id and removed_at is null and status in ('active','submitted')) then raise exception 'Cerra y aproba el reparto anterior';end if;
  return new;
 end if;
 limits:=private.plan_limits(plan);bucket:=case when new.status='planned' then 'planned_trips' else 'active_trips' end;
 if tg_op='UPDATE' then
  old_bucket:=case when old.removed_at is not null or old.status='closed' then null when old.status='planned' then 'planned_trips' else 'active_trips' end;
  if bucket=old_bucket then return new;end if;
 end if;
 cap:=(limits->>bucket)::integer;
 select count(*) into used from public.inventory_trips where tenant_id=new.tenant_id and id<>new.id and removed_at is null and case when bucket='planned_trips' then status='planned' else status in ('active','submitted') end;
 if cap is not null and used>=cap then raise exception 'Cupo del plan alcanzado: maximo % repartos %. Finaliza o elimina uno antes de agregar otro',cap,case when bucket='planned_trips' then 'preparados sin iniciar' else 'activos o pendientes de cierre' end;end if;
 return new;
end $$;
drop trigger inventory_open_trip_plan on public.inventory_trips;
create trigger inventory_open_trip_plan before insert or update on public.inventory_trips for each row execute function private.enforce_open_trip_plan();
-- Quotas now count active trucks across the company, not per driver.
do $patch$ declare def text;fn regprocedure;begin
 foreach fn in array array['private.inventory_post_core(uuid,uuid,text,uuid,uuid,jsonb,text)'::regprocedure,'public.assistant_confirm_load(uuid,uuid,uuid,uuid,jsonb,date,boolean,text)'::regprocedure] loop
 def:=pg_get_functiondef(fn);
 if position('and not exists(select 1 from public.licenses where tenant_id=p_tenant and driver_plan=''unlimited'') then raise exception' in def)=0 then raise exception 'Unexpected load plan contract';end if;
 execute replace(def,'and not exists(select 1 from public.licenses where tenant_id=p_tenant and driver_plan=''unlimited'') then raise exception','and not exists(select 1 from public.licenses where tenant_id=p_tenant and driver_plan in (''basic'',''intermediate'',''unlimited'')) then raise exception');
 end loop;
end $patch$;
-- Insert the requested family immediately: filling the third article slot must
-- not prevent creating an unrelated dispenser model through a temporary article.
create or replace function public.catalog_create_item(p_tenant uuid,p_id uuid,p_name text,p_price numeric,p_unit text,p_returnable boolean,p_family text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.products;begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede crear articulos' using errcode='42501';end if;
 if p_family is null or p_family not in ('article','dispenser') or p_price is null or p_price<0 or p_price>999999999999.99 or p_price<>round(p_price,2) then raise exception 'Tipo o precio invalido';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into existing from public.products where id=p_id;
 if found then
  if existing.tenant_id=p_tenant and existing.family=p_family and existing.name=p_name and existing.price=p_price and existing.unit=p_unit and existing.returnable=p_returnable then return p_id;end if;
  raise exception 'ID de articulo ya utilizado con otros datos';
 end if;
 insert into public.products(id,tenant_id,name,price,unit,returnable,family) values(p_id,p_tenant,p_name,p_price,p_unit,p_returnable,p_family);
 return p_id;
end $$;
create function public.owner_license_usage(p_tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare chosen_plan text;limit_values jsonb;begin
 if not(private.is_admin() or private.has_role(p_tenant,array['owner'])) then raise exception 'Solo el titular o superadministracion' using errcode='42501';end if;
 select driver_plan into chosen_plan from public.licenses where tenant_id=p_tenant;
 limit_values:=private.plan_limits(chosen_plan);
 if chosen_plan='custom' then limit_values:=jsonb_build_object('clients',null,'drivers',(select driver_limit from public.licenses where tenant_id=p_tenant),'articles',null,'dispensers',null,'active_trips',null,'planned_trips',null,'promotions',null);end if;
 return jsonb_build_object('plan',chosen_plan,'name',coalesce((select name from public.license_plan_catalog where license_plan_catalog.plan=chosen_plan),'Personalizado'),'limits',limit_values,'usage',private.plan_usage(p_tenant));
end $$;
revoke all on function public.owner_license_usage(uuid) from public,anon,authenticated;
grant execute on function public.owner_license_usage(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
