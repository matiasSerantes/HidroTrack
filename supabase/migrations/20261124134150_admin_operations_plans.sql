begin;
-- Keep one open truck per driver for current plans; Superior has independent trucks.
drop index public.inventory_one_open_trip;
create function private.enforce_open_trip_plan() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=new.tenant_id for update;
 if new.status in ('active','submitted') and coalesce((select driver_plan from public.licenses where tenant_id=new.tenant_id),'custom')<>'unlimited' and exists(select 1 from public.inventory_trips where tenant_id=new.tenant_id and driver_id=new.driver_id and id<>new.id and status in ('active','submitted')) then raise exception 'Cerra y aproba el reparto anterior';end if;
 return new;
end $$;
revoke all on function private.enforce_open_trip_plan() from public,anon,authenticated;
create trigger inventory_open_trip_plan before insert or update of status,driver_id on public.inventory_trips for each row execute function private.enforce_open_trip_plan();
do $patch$ declare def text;fn regprocedure;begin
 foreach fn in array array['private.inventory_post_core(uuid,uuid,text,uuid,uuid,jsonb,text)'::regprocedure,'public.assistant_confirm_load(uuid,uuid,uuid,uuid,jsonb,date,boolean,text)'::regprocedure] loop
 def:=pg_get_functiondef(fn);
 if position('and id<>p_trip and status in (''active'',''submitted'')) then raise exception' in def)=0 then raise exception 'Unexpected load contract';end if;
 execute replace(def,'and id<>p_trip and status in (''active'',''submitted'')) then raise exception','and id<>p_trip and status in (''active'',''submitted'')) and not exists(select 1 from public.licenses where tenant_id=p_tenant and driver_plan=''unlimited'') then raise exception');
 end loop;
end $patch$;
do $patch$ declare def text;begin
 def:=pg_get_functiondef('private.normalize_driver_plan()'::regprocedure);
 execute replace(def,'return new;', 'perform 1 from public.tenants where id=new.tenant_id for update; if new.driver_plan<>''unlimited'' and exists(select 1 from public.inventory_trips where tenant_id=new.tenant_id and status in (''active'',''submitted'') group by driver_id having count(*)>1) then raise exception ''Primero cierra los repartos abiertos adicionales antes de cambiar de plan'';end if; return new;');
end $patch$;
create table public.license_plan_catalog(plan text primary key check(plan in ('basic','intermediate','unlimited')),name text not null check(length(trim(name)) between 1 and 80),monthly_price numeric(14,2) check(monthly_price>=0),notes text not null default '' check(length(notes)<=1000),updated_at timestamptz not null default now());
insert into public.license_plan_catalog(plan,name) values('basic','Basico'),('intermediate','Intermedio'),('unlimited','Superior');
alter table public.license_plan_catalog enable row level security;
create policy license_plan_admin on public.license_plan_catalog for all to authenticated using(private.is_admin()) with check(private.is_admin());
revoke all on public.license_plan_catalog from public,anon,authenticated;
grant select,update(name,monthly_price,notes,updated_at) on public.license_plan_catalog to authenticated;
-- Authenticated administrative writes retain the actual admin identity. Member actors
-- keep the original company constraint through the guard; no membership is granted.
alter table public.inventory_operations drop constraint inventory_operations_tenant_id_actor_id_fkey;
alter table public.inventory_operations add foreign key(actor_id) references auth.users(id);
create function private.inventory_actor_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.tenant_members where tenant_id=new.tenant_id and user_id=new.actor_id) and not(new.actor_id=auth.uid() and private.is_admin() and new.kind in ('refill','close')) then raise exception 'Actor ajeno al inventario' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.inventory_actor_scope() from public,anon,authenticated;
create trigger inventory_actor_scope before insert or update of tenant_id,actor_id,kind on public.inventory_operations for each row execute function private.inventory_actor_scope();
create table private.admin_support_operations(tenant_id uuid not null references public.tenants(id),id uuid not null,actor_id uuid not null references auth.users(id),request jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(tenant_id,id));
alter table private.admin_support_operations enable row level security;
revoke all on private.admin_support_operations from public,anon,authenticated;
create function public.admin_company_operations(p_tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 return jsonb_build_object('products',coalesce((select jsonb_agg(to_jsonb(v) order by v.name,v.id) from(select p.id,p.name,coalesce(sum(m.depot_ready),0) ready,coalesce(sum(m.depot_empty),0) empties from public.products p left join public.inventory_movements m on m.tenant_id=p.tenant_id and m.product_id=p.id where p.tenant_id=p_tenant and p.active and p.returnable and p.family='article' group by p.id,p.name) v),'[]'::jsonb),'trips',coalesce((select jsonb_agg(to_jsonb(v) order by v.service_date desc,v.id) from(select t.id,t.name,t.service_date,t.status,coalesce(p.full_name,'Chofer') driver from public.inventory_trips t left join public.user_profiles p on p.user_id=t.driver_id where t.tenant_id=p_tenant and t.removed_at is null and t.status in ('active','submitted')) v),'[]'::jsonb),'history',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from(select id,actor_id,request,result,created_at from private.admin_support_operations where tenant_id=p_tenant order by created_at desc,id limit 20) v),'[]'::jsonb));
end $$;
create function public.admin_refill_stock(p_tenant uuid,p_id uuid,p_product uuid,p_quantity integer,p_expected_ready bigint,p_expected_empty bigint,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.admin_support_operations;payload jsonb;product public.products;ready bigint;empties bigint;result jsonb;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('kind','refill','product',p_product,'quantity',p_quantity,'ready',p_expected_ready,'empties',p_expected_empty,'note',p_note);
 select * into old from private.admin_support_operations where tenant_id=p_tenant and id=p_id;
 if found then if old.actor_id=auth.uid() and old.request=payload then return old.result;end if;raise exception 'ID usado con otros datos';end if;
 if p_id is null or p_quantity is null or p_quantity not between 1 and 100000 or p_note is null or length(p_note)>400 then raise exception 'Cantidad o referencia invalida';end if;
 select * into product from public.products where tenant_id=p_tenant and id=p_product and active and returnable and family='article';if not found then raise exception 'Producto no habilitado';end if;
 select coalesce(sum(depot_ready),0),coalesce(sum(depot_empty),0) into ready,empties from public.inventory_movements where tenant_id=p_tenant and product_id=p_product;
 if p_expected_ready is distinct from ready or p_expected_empty is distinct from empties then raise exception 'El stock cambio; actualiza antes de confirmar';end if;
 if p_quantity>empties then raise exception 'La cantidad supera los vacios disponibles';end if;
 insert into public.inventory_operations(tenant_id,id,actor_id,kind,items,note) values(p_tenant,p_id,auth.uid(),'refill',jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',p_quantity)),p_note);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,unit_price) values(p_tenant,p_id,p_product,p_quantity,-p_quantity,product.price);
 result:=jsonb_build_object('id',p_id,'kind','refill','ready',ready+p_quantity,'empties',empties-p_quantity);
 insert into private.admin_support_operations values(p_tenant,p_id,auth.uid(),payload,result,now());return result;
end $$;
create function public.admin_preview_trip_close(p_tenant uuid,p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and removed_at is null and status in ('active','submitted')) then raise exception 'Reparto no abierto';end if;
 return private.owner_close_quote(p_tenant,p_trip);
end $$;
create function public.admin_finish_trip(p_tenant uuid,p_id uuid,p_trip uuid,p_expected jsonb,p_cash numeric,p_transfer numeric,p_stock jsonb,p_confirm_unvisited boolean default false,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.admin_support_operations;payload jsonb;q jsonb;counted jsonb;expected jsonb;closure public.trip_closures;trip public.inventory_trips;operation uuid;result jsonb;shared jsonb;item jsonb;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('kind','close','trip',p_trip,'expected',p_expected,'cash',p_cash,'transfer',p_transfer,'stock',p_stock,'confirm_unvisited',p_confirm_unvisited,'note',p_note);
 select * into old from private.admin_support_operations where tenant_id=p_tenant and id=p_id;
 if found then if old.actor_id=auth.uid() and old.request=payload then return old.result;end if;raise exception 'ID usado con otros datos';end if;
 if p_id is null or p_expected is null or p_note is null or length(p_note)>400 then raise exception 'Cierre invalido';end if;
 select * into trip from public.inventory_trips where tenant_id=p_tenant and id=p_trip and removed_at is null and status in ('active','submitted') for update;
 if not found then raise exception 'Reparto no abierto';end if;
 q:=private.owner_close_quote(p_tenant,p_trip);if q<>p_expected then raise exception 'El reparto cambio; actualiza el resumen';end if;
 counted:=private.trip_normalize_stock(p_stock);expected:=private.trip_expected_stock(p_tenant,p_trip);
 if counted<>expected or p_cash is distinct from (q->>'cash')::numeric or p_transfer is distinct from (q->>'transfer')::numeric then raise exception 'El conteo no coincide con caja o stock';end if;
 if (q->>'equipment_count')::integer>0 then raise exception 'Primero devuelve los equipos identificados desde Catalogo';end if;
 if (q->>'pending_visits')::integer>0 then if p_confirm_unvisited is distinct from true then raise exception 'Confirma las paradas sin visitar';end if;perform private.confirm_unvisited_stops(p_tenant,p_trip,p_id);q:=private.owner_close_quote(p_tenant,p_trip);end if;
 shared:=private.assistant_close_quote(p_tenant,p_trip);
 select * into closure from public.trip_closures where tenant_id=p_tenant and trip_id=p_trip and status='submitted';
 operation:=coalesce(closure.id,p_id);
 if closure.id is not null then
  if closure.declared_cash<>p_cash or closure.declared_transfer<>p_transfer or closure.declared_stock<>expected then raise exception 'Rendicion con diferencias; concilia antes de cerrar';end if;
  update public.trip_closures set status='approved',decided_by=auth.uid(),decided_at=now(),decision_note=p_note where tenant_id=p_tenant and id=operation;
 else
  insert into public.trip_closures(tenant_id,id,trip_id,actor_id,expected_cash,expected_transfer,declared_cash,declared_transfer,expected_stock,declared_stock,note,status,decided_by,decided_at,decision_note) values(p_tenant,operation,p_trip,auth.uid(),p_cash,p_transfer,p_cash,p_transfer,expected,counted,p_note,'approved',auth.uid(),now(),p_note);
 end if;
 insert into public.inventory_operations(tenant_id,id,trip_id,actor_id,kind,items,note) select p_tenant,operation,p_trip,auth.uid(),'close',coalesce(jsonb_agg(jsonb_build_object('product_id',i->>'product_id','quantity',i->'ready')),'[]'::jsonb),p_note from jsonb_array_elements(expected) i;
 for item in select value from jsonb_array_elements(expected) loop
  insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,truck_ready,truck_empty,unit_price) select p_tenant,operation,id,(item->>'ready')::integer,(item->>'empties')::integer,-(item->>'ready')::integer,-(item->>'empties')::integer,price from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid;
 end loop;
 update public.inventory_trips set status='closed',submitted_at=coalesce(submitted_at,now()),closed_at=now() where tenant_id=p_tenant and id=p_trip;
 result:=q||jsonb_build_object('id',operation,'closed_at',now(),'closed_by_admin',auth.uid(),'note',p_note,'closure_state','approved','trip',(q->'trip')||jsonb_build_object('status','closed'));
 if closure.id is null then
  insert into public.owner_trip_close_snapshots(tenant_id,id,trip_id,actor_id,request,snapshot) values(p_tenant,operation,p_trip,auth.uid(),payload,result);
 end if;
 -- Shared receipt uses the assigned driver's identity but identifies who closed it;
 -- initial load is explicitly stripped of private filling-cost fields.
 if exists(select 1 from public.assistant_trip_close_snapshots where tenant_id=p_tenant and id=operation) then
  update public.assistant_trip_close_snapshots set snapshot=snapshot||jsonb_build_object('closure_state','approved','closed_at',now(),'closed_by_admin',auth.uid(),'decision_note',p_note,'visit_states',q->'visit_states','trip',(q->'trip')||jsonb_build_object('status','closed')) where tenant_id=p_tenant and id=operation;
 else
  insert into public.assistant_trip_close_snapshots(tenant_id,id,trip_id,actor_id,request,snapshot) values(p_tenant,operation,p_trip,trip.driver_id,payload,shared||jsonb_build_object('trip',(q->'trip')||jsonb_build_object('status','closed'),'id',operation,'company',(select name from public.tenants where id=p_tenant),'driver',(select full_name from public.user_profiles where user_id=trip.driver_id),'closed_at',now(),'closure_state','approved','declared_cash',p_cash,'declared_transfer',p_transfer,'declared_stock',counted,'closed_by_admin',auth.uid(),'note',p_note));
 end if;
 insert into private.admin_support_operations values(p_tenant,p_id,auth.uid(),payload,result,now());return result;
end $$;
revoke all on function public.admin_company_operations(uuid),public.admin_refill_stock(uuid,uuid,uuid,integer,bigint,bigint,text),public.admin_preview_trip_close(uuid,uuid),public.admin_finish_trip(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_company_operations(uuid),public.admin_refill_stock(uuid,uuid,uuid,integer,bigint,bigint,text),public.admin_preview_trip_close(uuid,uuid),public.admin_finish_trip(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,boolean,text) to authenticated;
do $patch$ declare def text;begin
 def:=pg_get_functiondef('public.owner_self_close_history(uuid)'::regprocedure);execute replace(def,'and actor_id=auth.uid()','and (actor_id=auth.uid() or exists(select 1 from public.inventory_trips t where t.tenant_id=p_tenant and t.id=trip_id and t.driver_id=auth.uid()))');
end $patch$;
notify pgrst,'reload schema';
commit;
