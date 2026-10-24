begin;
create table public.assistant_delivery_receipts (
 tenant_id uuid not null,
 id uuid not null,
 actor_id uuid not null references auth.users(id),
 trip_id uuid not null,
 customer_id uuid not null,
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,id) references public.sales(tenant_id,id),
 foreign key(tenant_id,trip_id,customer_id) references public.inventory_trip_customers(tenant_id,trip_id,customer_id)
);
alter table public.assistant_delivery_receipts enable row level security;
create policy assistant_delivery_receipts_owner on public.assistant_delivery_receipts for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.assistant_delivery_receipts from public,anon,authenticated;
grant select on public.assistant_delivery_receipts to authenticated;

create function public.assistant_customer_visit(p_tenant uuid,p_trip uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare stop public.route_stops; customer public.customers;
begin
 if not private.accepted_trip_access(p_tenant,p_trip) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no aceptado o no activo' using errcode='42501'; end if;
 select * into stop from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer and active;
 select * into customer from public.customers where tenant_id=p_tenant and id=p_customer and active;
 if stop.customer_id is null or customer.id is null then raise exception 'Cliente no asignado o inactivo' using errcode='42501'; end if;
 return jsonb_build_object('customer',jsonb_build_object('id',customer.id,'name',customer.name,'pending_recovery',customer.pending_recovery),
 'version',stop.version,'outcome',stop.outcome,
 'balance',coalesce((select sum(s.total-coalesce((select sum(p.amount) from public.payments p where p.tenant_id=s.tenant_id and p.sale_id=s.id),0)) from public.sales s where s.tenant_id=p_tenant and s.customer_id=p_customer),0),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'returnable',p.returnable,'active',p.active,'ready',b.ready,'held',b.held) order by p.name,p.id)
 from public.products p cross join lateral (
  select coalesce(sum(m.truck_ready) filter(where o.trip_id=p_trip),0) ready,coalesce(sum(m.customer_held) filter(where o.customer_id=p_customer),0) held
  from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p.id
 ) b where p.tenant_id=p_tenant and p.family='article' and ((p.active and b.ready>0) or b.held>0)),'[]'::jsonb),
 'equipment',coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'mode',a.mode,'monthly',a.monthly)) from public.dispenser_assignments a join public.products p on p.tenant_id=a.tenant_id and p.id=a.product_id where a.tenant_id=p_tenant and a.customer_id=p_customer and a.status='active'),'[]'::jsonb)
 ||coalesce((select jsonb_agg(jsonb_build_object('name',name,'mode',mode,'monthly',monthly)) from public.dispensers where tenant_id=p_tenant and customer_id=p_customer and not retired),'[]'::jsonb));
end $$;

create function public.assistant_deliver(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_version integer,p_items jsonb,p_expected_total numeric,p_paid numeric,p_method text,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.assistant_delivery_receipts; stop public.route_stops; product public.products; item jsonb; q numeric; r numeric; truck bigint; held bigint; seen uuid[]:='{}'; total numeric:=0; payload jsonb; receipt jsonb; day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 -- Authorization is checked even on retry. Revocation never grants a receipt.
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 payload:=jsonb_build_object('version',p_version,'items',p_items,'expected_total',p_expected_total,'paid',p_paid,'method',p_method,'note',p_note);
 select * into prior from public.assistant_delivery_receipts where tenant_id=p_tenant and id=p_id;
 if found then
  if prior.actor_id=auth.uid() and prior.trip_id=p_trip and prior.customer_id=p_customer and prior.request=payload then return prior.result; end if;
  raise exception 'ID de entrega utilizado con otros datos';
 end if;
 if p_id is null or p_version is null or p_expected_total is null or p_expected_total<0 or p_expected_total<>round(p_expected_total,2) or p_paid is null or p_paid<0 or p_paid>999999999999.99 or p_paid<>round(p_paid,2) or p_note is null or length(p_note)>400
 or (p_paid=0 and p_method is not null) or (p_paid>0 and (p_method is null or p_method not in ('cash','transfer'))) then raise exception 'Entrega o cobro invalido'; end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no activo'; end if;
 select * into stop from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer and active for update;
 if not found or not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no asignado o inactivo' using errcode='42501'; end if;
 if stop.version<>p_version or stop.outcome in ('delivered','no_purchase') then raise exception 'La parada cambio o ya fue resuelta; actualiza el recorrido'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Indica entre 1 y 200 productos'; end if;
 if exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.sales where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.payments where tenant_id=p_tenant and id=p_id) then raise exception 'ID de operacion utilizado'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  q:=(item->>'quantity')::numeric;r:=coalesce((item->>'returned')::numeric,0);
  if q is null or q<0 or q>100000 or q<>trunc(q) or r<0 or r>100000 or r<>trunc(r) or q+r=0 then raise exception 'Cantidades invalidas'; end if;
  select * into product from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid for share;
  if not found or product.family<>'article' or (q>0 and not product.active) or product.id=any(seen) or (r>0 and not product.returnable) then raise exception 'Producto no habilitado, repetido o devolucion invalida'; end if;
  seen:=array_append(seen,product.id);
  select coalesce(sum(m.truck_ready) filter(where o.trip_id=p_trip),0),coalesce(sum(m.customer_held) filter(where o.customer_id=p_customer),0)
  into truck,held from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=product.id;
  if q>truck then raise exception 'Stock insuficiente en camion'; end if;
  if r>held+q then raise exception 'Devuelve mas envases de los que tiene'; end if;
  total:=total+q*product.price;
 end loop;
 if total<>p_expected_total then raise exception 'El precio cambio; actualiza la planilla antes de confirmar'; end if;
 if p_paid>total then raise exception 'El cobro supera esta entrega; cobrar deuda anterior requiere otra operacion'; end if;
 -- Existing recovery, equipment, invoice-identity and route-delivery guards apply.
 insert into public.inventory_operations(tenant_id,id,kind,trip_id,customer_id,actor_id,items,note,occurred_on)
 values(p_tenant,p_id,'delivery',p_trip,p_customer,auth.uid(),p_items,p_note,day);
 for item in select value from jsonb_array_elements(p_items) loop
  q:=(item->>'quantity')::integer;r:=coalesce((item->>'returned')::integer,0);
  select * into product from public.products where tenant_id=p_tenant and id=(item->>'product_id')::uuid;
  insert into public.inventory_movements(tenant_id,operation_id,product_id,truck_ready,truck_empty,customer_held,unit_price)
  values(p_tenant,p_id,product.id,-q,r,case when product.returnable then q-r else 0 end,product.price);
 end loop;
 insert into public.sales(tenant_id,id,trip_id,customer_id,actor_id,total,initial_paid,initial_method,occurred_on)
 values(p_tenant,p_id,p_trip,p_customer,auth.uid(),total,p_paid,p_method,day);
 insert into public.sale_items(tenant_id,sale_id,product_id,product_name,quantity,unit_price)
 select p_tenant,p_id,p.id,p.name,(i->>'quantity')::integer,p.price from jsonb_array_elements(p_items) i join public.products p on p.tenant_id=p_tenant and p.id=(i->>'product_id')::uuid where (i->>'quantity')::integer>0;
 if p_paid>0 then
  insert into public.payments(tenant_id,id,sale_id,trip_id,actor_id,amount,method,occurred_on,note) values(p_tenant,p_id,p_id,p_trip,auth.uid(),p_paid,p_method,day,p_note);
 end if;
 if total>p_paid then
  insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status) values(p_tenant,p_id,auth.uid(),total-p_paid,'pending');
 end if;
 insert into public.owner_notifications(tenant_id,recipient_id,sale_id,kind)
 select p_tenant,m.user_id,p_id,k.kind from public.tenant_members m cross join (select 'delivery'::text kind union all select 'credit_request' where total>p_paid) k where m.tenant_id=p_tenant and m.role='owner' and m.active;
 receipt:=jsonb_build_object('id',p_id,'total',total,'paid',p_paid,'remaining',total-p_paid,'credit_status',case when total>p_paid then 'pending' else 'paid' end,'version',(select version from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer));
 insert into public.assistant_delivery_receipts(tenant_id,id,actor_id,trip_id,customer_id,request,result) values(p_tenant,p_id,auth.uid(),p_trip,p_customer,payload,receipt);
 return receipt;
end $$;

create function public.owner_credit_inbox(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede consultar deudas' using errcode='42501'; end if;
 return jsonb_build_object('count',(select count(*) from public.credit_requests where tenant_id=p_tenant and status='pending'),
 'items',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at,v.sale_id) from (
 select r.sale_id,r.created_at,c.name customer,t.name trip,s.total,s.initial_paid,
 s.total-coalesce((select sum(p.amount) from public.payments p where p.tenant_id=s.tenant_id and p.sale_id=s.id),0) balance
 from public.credit_requests r join public.sales s on s.tenant_id=r.tenant_id and s.id=r.sale_id join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id
 left join public.inventory_trips t on t.tenant_id=s.tenant_id and t.id=s.trip_id
 where r.tenant_id=p_tenant and r.status='pending' order by r.created_at,r.sale_id limit 20
 ) v),'[]'::jsonb));
end $$;
revoke all on function public.assistant_customer_visit(uuid,uuid,uuid),public.assistant_deliver(uuid,uuid,uuid,uuid,integer,jsonb,numeric,numeric,text,text),public.owner_credit_inbox(uuid) from public,anon,authenticated;
grant execute on function public.assistant_customer_visit(uuid,uuid,uuid),public.assistant_deliver(uuid,uuid,uuid,uuid,integer,jsonb,numeric,numeric,text,text),public.owner_credit_inbox(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
