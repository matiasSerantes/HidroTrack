begin;
create table public.owner_trip_close_snapshots (
 tenant_id uuid not null,
 id uuid not null,
 trip_id uuid not null,
 actor_id uuid not null references auth.users(id),
 request jsonb not null,
 snapshot jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 unique(tenant_id,trip_id),
 foreign key(tenant_id,id) references public.trip_closures(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.owner_trip_close_snapshots enable row level security;
create policy owner_trip_close_snapshots_read on public.owner_trip_close_snapshots for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.owner_trip_close_snapshots from public,anon,authenticated;
grant select on public.owner_trip_close_snapshots to authenticated;

create function private.owner_close_quote(t uuid,r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'trip',(select jsonb_build_object('id',id,'name',name,'date',service_date,'status',status) from public.inventory_trips where tenant_id=t and id=r),
 'cash',coalesce((select sum(amount) from public.payments where tenant_id=t and trip_id=r and method='cash'),0),
 'transfer',coalesce((select sum(amount) from public.payments where tenant_id=t and trip_id=r and method='transfer'),0),
 'sales',coalesce((select sum(total) from public.sales where tenant_id=t and trip_id=r),0),
 'pending_visits',(select count(*) from public.route_stops s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id where s.tenant_id=t and s.trip_id=r and s.active and c.active and s.outcome in ('pending','present')),
 'equipment_count',(select count(*) from public.dispensers where tenant_id=t and trip_id=r and location='truck' and not retired),
 'pending_closure',exists(select 1 from public.trip_closures where tenant_id=t and trip_id=r and status='submitted'),
 'stock',coalesce((select jsonb_agg(jsonb_build_object('product_id',i->>'product_id','name',p.name,'family',p.family,'ready',i->'ready','empties',i->'empties') order by p.id) from jsonb_array_elements(private.trip_expected_stock(t,r)) i join public.products p on p.tenant_id=t and p.id=(i->>'product_id')::uuid),'[]'::jsonb),
 'initial_load',coalesce((select items from public.inventory_load_snapshots where tenant_id=t and trip_id=r),(select jsonb_agg(jsonb_build_object('product_id',m.product_id,'name',p.name,'loaded',m.truck_ready) order by p.id) from public.inventory_operations o join public.inventory_movements m on m.tenant_id=o.tenant_id and m.operation_id=o.id join public.products p on p.tenant_id=m.tenant_id and p.id=m.product_id where o.tenant_id=t and o.trip_id=r and o.kind='load'),'[]'::jsonb),
 'revision',jsonb_build_object('operations',(select count(*) from public.inventory_operations where tenant_id=t and trip_id=r),'payments',(select count(*) from public.payments where tenant_id=t and trip_id=r),'stops',coalesce((select jsonb_agg(jsonb_build_array(customer_id,version,active) order by customer_id) from public.route_stops where tenant_id=t and trip_id=r),'[]'::jsonb))
 );
$$;
revoke all on function private.owner_close_quote(uuid,uuid) from public,anon,authenticated;

create function public.owner_preview_trip_close(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid() and status in ('active','submitted')) then raise exception 'Solo el jefe asignado puede cerrar su reparto abierto' using errcode='42501'; end if;
 return private.owner_close_quote(p_tenant,p_trip);
end $$;

create function public.owner_finish_self_trip(p_tenant uuid,p_id uuid,p_trip uuid,p_expected jsonb,p_cash numeric,p_transfer numeric,p_stock jsonb,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.owner_trip_close_snapshots; current_quote jsonb; counted jsonb; expected_stock jsonb; payload jsonb; result jsonb; items jsonb;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner']) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid()) then raise exception 'Solo el jefe asignado puede cerrar su reparto' using errcode='42501'; end if;
 if p_id is null or p_expected is null or jsonb_typeof(p_expected)<>'object' or p_cash is null or p_transfer is null or p_cash not between 0 and 999999999999.99 or p_transfer not between 0 and 999999999999.99 or p_cash<>round(p_cash,2) or p_transfer<>round(p_transfer,2) or p_note is null or length(p_note)>400 then raise exception 'Conteo o cierre invalido'; end if;
 counted:=private.trip_normalize_stock(p_stock);
 payload:=jsonb_build_object('expected',p_expected,'cash',p_cash,'transfer',p_transfer,'stock',counted,'note',p_note);
 select * into prior from public.owner_trip_close_snapshots where tenant_id=p_tenant and id=p_id;
 if found then
  if prior.actor_id=auth.uid() and prior.trip_id=p_trip and prior.request=payload then return prior.snapshot; end if;
  raise exception 'ID de cierre utilizado con otros datos';
 end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status in ('active','submitted')) then raise exception 'Reparto ya cerrado o no activo'; end if;
 if exists(select 1 from public.trip_closures where tenant_id=p_tenant and trip_id=p_trip and status in ('submitted','approved')) then raise exception 'Ya existe una rendicion; resolverla antes de registrar otra'; end if;
 if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.sales where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.payments where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.trip_closures where tenant_id=p_tenant and id=p_id) then raise exception 'ID de operacion utilizado'; end if;
 current_quote:=private.owner_close_quote(p_tenant,p_trip);
 if current_quote<>p_expected then raise exception 'El reparto cambio; actualiza el resumen y conta de nuevo'; end if;
 if (current_quote->>'pending_visits')::integer>0 then raise exception 'Quedan clientes sin resultado; registra atencion o ausencia antes de cerrar'; end if;
 if (current_quote->>'equipment_count')::integer>0 then raise exception 'Devolve los equipos identificados desde Catalogo antes de cerrar'; end if;
 expected_stock:=private.trip_expected_stock(p_tenant,p_trip);
 if counted<>expected_stock or p_cash<>(current_quote->>'cash')::numeric or p_transfer<>(current_quote->>'transfer')::numeric then raise exception 'El conteo no coincide; concilia stock, roturas o cobros antes de cerrar'; end if;
 perform public.inventory_submit_trip(p_tenant,p_trip);
 insert into public.trip_closures(tenant_id,id,trip_id,actor_id,expected_cash,expected_transfer,declared_cash,declared_transfer,expected_stock,declared_stock,note,status,decided_by,decided_at,decision_note)
 values(p_tenant,p_id,p_trip,auth.uid(),p_cash,p_transfer,p_cash,p_transfer,expected_stock,counted,p_note,'approved',auth.uid(),now(),p_note);
 select coalesce(jsonb_agg(jsonb_build_object('product_id',i->>'product_id','quantity',(i->>'ready')::integer)),'[]'::jsonb) into items from jsonb_array_elements(counted) i;
 perform public.inventory_post(p_tenant,p_id,'close',p_trip,null,items,p_note);
 result:=current_quote||jsonb_build_object('id',p_id,'closed_at',now(),'note',p_note,'trip',(current_quote->'trip')||jsonb_build_object('status','closed'));
 insert into public.owner_trip_close_snapshots(tenant_id,id,trip_id,actor_id,request,snapshot) values(p_tenant,p_id,p_trip,auth.uid(),payload,result);
 -- Preserve last position as historical data; fleet freshness uses trip status.
 return result;
end $$;

create function public.owner_self_close_history(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede consultar sus cierres' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(v.snapshot order by v.created_at desc,v.id) from (select id,snapshot,created_at from public.owner_trip_close_snapshots where tenant_id=p_tenant and actor_id=auth.uid() order by created_at desc,id limit 10) v),'[]'::jsonb);
end $$;
revoke all on function public.owner_preview_trip_close(uuid,uuid),public.owner_finish_self_trip(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text),public.owner_self_close_history(uuid) from public,anon,authenticated;
grant execute on function public.owner_preview_trip_close(uuid,uuid),public.owner_finish_self_trip(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text),public.owner_self_close_history(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
