begin;
create table public.sale_combos(
 tenant_id uuid not null references public.tenants(id),id uuid not null,name text not null check(length(trim(name)) between 1 and 100),
 price numeric(14,2) not null check(price>=0),items jsonb not null,active boolean not null default true,version integer not null default 1,
 primary key(tenant_id,id)
);
alter table public.sale_combos enable row level security;
create policy sale_combos_owner on public.sale_combos for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.sale_combos from public,anon,authenticated;
grant select on public.sale_combos to authenticated;
create table private.sale_combo_commands(tenant_id uuid not null,id uuid not null,actor_id uuid not null,request jsonb not null,primary key(tenant_id,id));
revoke all on private.sale_combo_commands from public,anon,authenticated;
create table public.sale_combo_lines(
 tenant_id uuid not null,sale_id uuid not null,combo_id uuid not null,name text not null,quantity integer not null check(quantity>0),price numeric(14,2) not null,items jsonb not null,version integer not null,
 primary key(tenant_id,sale_id,combo_id),foreign key(tenant_id,sale_id) references public.sales(tenant_id,id),foreign key(tenant_id,combo_id) references public.sale_combos(tenant_id,id)
);
alter table public.sale_combo_lines enable row level security;
create policy sale_combo_lines_read on public.sale_combo_lines for select to authenticated using(exists(select 1 from public.sales s where s.tenant_id=sale_combo_lines.tenant_id and s.id=sale_combo_lines.sale_id));
revoke all on public.sale_combo_lines from public,anon,authenticated;
grant select on public.sale_combo_lines to authenticated;

create function public.owner_save_sale_combo(p_tenant uuid,p_request uuid,p_id uuid,p_version integer,p_name text,p_price numeric,p_items jsonb,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare payload jsonb; prior private.sale_combo_commands; c public.sale_combos; item jsonb; seen uuid[]:='{}'; product uuid; q numeric;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede crear o editar combos' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('id',p_id,'version',p_version,'name',p_name,'price',p_price,'items',p_items,'active',p_active);
 select * into prior from private.sale_combo_commands where tenant_id=p_tenant and id=p_request;
 if found then if prior.actor_id=auth.uid() and prior.request=payload then return p_id; end if; raise exception 'ID de combo usado con otros datos'; end if;
 if p_id is null or p_request is null or p_version is null or p_version<0 or p_name is null or length(trim(p_name)) not between 1 and 100 or p_price is null or p_price<0 or p_price>999999999999.99 or p_price<>round(p_price,2) or p_price::text in ('NaN','Infinity','-Infinity') or p_active is null then raise exception 'Nombre o precio del combo invalido'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'Indica entre 1 y 40 articulos del combo'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  product:=(item->>'product_id')::uuid;q:=(item->>'quantity')::numeric;
  if product is null or product=any(seen) or q is null or q not between 1 and 100000 or q<>trunc(q) or not exists(select 1 from public.products where tenant_id=p_tenant and id=product and family='article' and (active or not p_active)) then raise exception 'Articulo o cantidad del combo invalido'; end if;
  seen:=array_append(seen,product);
 end loop;
 select * into c from public.sale_combos where tenant_id=p_tenant and id=p_id;
 if found then
  if c.version<>p_version then raise exception 'El combo cambio. Actualiza antes de guardar'; end if;
  update public.sale_combos set name=trim(p_name),price=p_price,items=p_items,active=p_active,version=version+1 where tenant_id=p_tenant and id=p_id;
 else
  if p_version<>0 then raise exception 'Combo no disponible'; end if;
  insert into public.sale_combos(tenant_id,id,name,price,items,active) values(p_tenant,p_id,trim(p_name),p_price,p_items,p_active);
 end if;
 insert into private.sale_combo_commands values(p_tenant,p_request,auth.uid(),payload);
 return p_id;
end $$;

create function private.available_sale_combos(t uuid,r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'price',c.price,'items',c.items,'active',c.active,'version',c.version,'available',b.available) order by c.name,c.id),'[]'::jsonb)
 from public.sale_combos c cross join lateral(
  select greatest(0,min(case when p.id is null or not p.active or p.family<>'article' then 0 else floor(coalesce(s.units,0)/(i->>'quantity')::numeric) end)) available
  from jsonb_array_elements(c.items) i left join public.products p on p.tenant_id=t and p.id=(i->>'product_id')::uuid
  cross join lateral(select sum(case when r is null then m.depot_ready else m.truck_ready end) units from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=t and m.product_id=(i->>'product_id')::uuid and (r is null or o.trip_id=r)) s
 ) b where c.tenant_id=t and (r is null or c.active);
$$;
revoke all on function private.available_sale_combos(uuid,uuid) from public,anon,authenticated;
create function public.owner_sale_combos(p_tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede consultar combos' using errcode='42501'; end if;
 return private.available_sale_combos(p_tenant,null);
end $$;

-- The existing guarded visit read remains the authority for route/customer access.
alter function public.assistant_customer_visit(uuid,uuid,uuid) set schema private;
alter function private.assistant_customer_visit(uuid,uuid,uuid) rename to customer_visit_before_combos;
revoke all on function private.customer_visit_before_combos(uuid,uuid,uuid) from public,anon,authenticated;
create function public.assistant_customer_visit(p_tenant uuid,p_trip uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.customer_visit_before_combos(p_tenant,p_trip,p_customer);
 return result||jsonb_build_object('combos',case when private.has_role(p_tenant,array['owner']) or exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=auth.uid() and active and promotion_allowed) then private.available_sale_combos(p_tenant,p_trip) else '[]'::jsonb end);
end $$;

create function private.sale_combo_quote(t uuid,r uuid,delivered jsonb,combos jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry jsonb; part jsonb; c public.sale_combos; count numeric; bundled jsonb:='{}'; snapshots jsonb:='[]'; seen uuid[]:='{}'; list_total numeric:=0; combo_total numeric:=0; q numeric; price numeric;
begin
 if not private.has_role(t,array['owner']) and not exists(select 1 from public.tenant_members where tenant_id=t and user_id=auth.uid() and active and promotion_allowed) then raise exception 'El jefe debe habilitar promociones' using errcode='42501'; end if;
 if combos is null or jsonb_typeof(combos)<>'array' or jsonb_array_length(combos) not between 1 and 40 then raise exception 'Combos invalidos'; end if;
 for entry in select value from jsonb_array_elements(combos) loop
  select * into c from public.sale_combos where tenant_id=t and id=(entry->>'id')::uuid and active;
  count:=(entry->>'quantity')::numeric;
  if not found or c.id=any(seen) or count is null or count not between 1 and 100000 or count<>trunc(count) or (entry->>'version')::integer is distinct from c.version then raise exception 'El combo cambio o no esta disponible. Actualiza la planilla'; end if;
  seen:=array_append(seen,c.id);
  for part in select value from jsonb_array_elements(c.items) loop
   select p.price into price from public.products p where p.tenant_id=t and p.id=(part->>'product_id')::uuid and active and family='article';
   if not found then raise exception 'Articulo del combo no disponible'; end if;
   q:=(part->>'quantity')::numeric*count;
   bundled:=jsonb_set(bundled,array[part->>'product_id'],to_jsonb(coalesce((bundled->>(part->>'product_id'))::numeric,0)+q));
   list_total:=list_total+q*price;
  end loop;
  combo_total:=combo_total+c.price*count;
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('id',c.id,'version',c.version,'name',c.name,'price',c.price,'quantity',count,'items',c.items));
 end loop;
 for part in select to_jsonb(e) from jsonb_each(bundled) e loop
  if (part->>'value')::numeric>coalesce((select sum((x->>'quantity')::numeric) from jsonb_array_elements(delivered) x where x->>'product_id'=part->>'key'),0) then raise exception 'Los articulos entregados no cubren los combos'; end if;
 end loop;
 return jsonb_build_object('discount',list_total-combo_total,'bundled',bundled,'lines',snapshots);
end $$;
revoke all on function private.sale_combo_quote(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;

create function public.assistant_deliver_with_combos(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_version integer,p_items jsonb,p_expected_total numeric,p_paid numeric,p_method text,p_note text default '',p_combos jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.assistant_delivery_receipts; stop public.route_stops; product public.products; item jsonb; q numeric; r numeric; truck bigint; held bigint; seen uuid[]:='{}'; total numeric:=0; payload jsonb; receipt jsonb; quote jsonb; day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 -- Authorization is checked even on retry. Revocation never grants a receipt.
 if not private.operational_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 payload:=jsonb_build_object('version',p_version,'items',p_items,'expected_total',p_expected_total,'paid',p_paid,'method',p_method,'note',p_note,'combos',p_combos);
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
 quote:=private.sale_combo_quote(p_tenant,p_trip,p_items,p_combos);
 total:=total-(quote->>'discount')::numeric;
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
 insert into public.sales(tenant_id,id,trip_id,customer_id,actor_id,total,initial_paid,initial_method,occurred_on,description)
 values(p_tenant,p_id,p_trip,p_customer,auth.uid(),total,p_paid,p_method,day,left('Combos: '||(select string_agg((v->>'quantity')||' x '||(v->>'name')||' ($'||(v->>'price')||')','; ') from jsonb_array_elements(quote->'lines') v),400));
 insert into public.sale_items(tenant_id,sale_id,product_id,product_name,quantity,unit_price)
 select p_tenant,p_id,p.id,p.name,(i->>'quantity')::integer-coalesce((quote->'bundled'->>p.id::text)::integer,0),p.price from jsonb_array_elements(p_items) i join public.products p on p.tenant_id=p_tenant and p.id=(i->>'product_id')::uuid where (i->>'quantity')::integer-coalesce((quote->'bundled'->>p.id::text)::integer,0)>0;
 insert into public.sale_combo_lines(tenant_id,sale_id,combo_id,name,quantity,price,items,version)
 select p_tenant,p_id,(v->>'id')::uuid,v->>'name',(v->>'quantity')::integer,(v->>'price')::numeric,v->'items',(v->>'version')::integer from jsonb_array_elements(quote->'lines') v;
 if p_paid>0 then
  insert into public.payments(tenant_id,id,sale_id,trip_id,actor_id,amount,method,occurred_on,note) values(p_tenant,p_id,p_id,p_trip,auth.uid(),p_paid,p_method,day,p_note);
 end if;
 if total>p_paid then
  insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status,decided_by,decided_at) values(p_tenant,p_id,auth.uid(),total-p_paid,case when private.has_role(p_tenant,array['owner']) then 'approved' else 'pending' end,case when private.has_role(p_tenant,array['owner']) then auth.uid() else null end,case when private.has_role(p_tenant,array['owner']) then now() else null end);
 end if;
 insert into public.owner_notifications(tenant_id,recipient_id,sale_id,kind)
 select p_tenant,m.user_id,p_id,k.kind from public.tenant_members m cross join (select 'delivery'::text kind union all select 'credit_request' where total>p_paid) k where m.tenant_id=p_tenant and m.role='owner' and m.active and m.user_id<>auth.uid();
 receipt:=jsonb_build_object('id',p_id,'total',total,'paid',p_paid,'remaining',total-p_paid,'credit_status',case when total>p_paid then case when private.has_role(p_tenant,array['owner']) then 'approved' else 'pending' end else 'paid' end,'combos',quote->'lines','version',(select version from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer));
 insert into public.assistant_delivery_receipts(tenant_id,id,actor_id,trip_id,customer_id,request,result) values(p_tenant,p_id,auth.uid(),p_trip,p_customer,payload,receipt);
 return receipt;
end $$;



revoke all on function public.owner_sale_combos(uuid),public.owner_save_sale_combo(uuid,uuid,uuid,integer,text,numeric,jsonb,boolean),public.assistant_customer_visit(uuid,uuid,uuid),public.assistant_deliver_with_combos(uuid,uuid,uuid,uuid,integer,jsonb,numeric,numeric,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.owner_sale_combos(uuid),public.owner_save_sale_combo(uuid,uuid,uuid,integer,text,numeric,jsonb,boolean),public.assistant_customer_visit(uuid,uuid,uuid),public.assistant_deliver_with_combos(uuid,uuid,uuid,uuid,integer,jsonb,numeric,numeric,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
