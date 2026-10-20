begin;
-- A charge is backed by one immutable delivery; payments never alter the inventory.
create table public.sales (
 tenant_id uuid not null,
 id uuid not null,
 trip_id uuid not null,
 customer_id uuid not null,
 actor_id uuid not null references auth.users(id),
 total numeric(14,2) not null check(total>=0),
 initial_paid numeric(14,2),
 initial_method text,
 occurred_on date not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,id) references public.inventory_operations(tenant_id,id),
 foreign key(tenant_id,trip_id,customer_id) references public.inventory_trip_customers(tenant_id,trip_id,customer_id)
);
create index sales_customer on public.sales(tenant_id,customer_id,created_at);
create table public.sale_items (
 tenant_id uuid not null,
 sale_id uuid not null,
 product_id uuid not null,
 product_name text not null,
 quantity integer not null check(quantity>0),
 unit_price numeric(14,2) not null check(unit_price>=0),
 primary key(tenant_id,sale_id,product_id),
 foreign key(tenant_id,sale_id) references public.sales(tenant_id,id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id)
);
create table public.payments (
 tenant_id uuid not null,
 id uuid not null,
 sale_id uuid not null,
 trip_id uuid,
 actor_id uuid not null references auth.users(id),
 amount numeric(14,2) not null check(amount>0),
 method text not null check(method in ('cash','transfer')),
 occurred_on date not null,
 note text not null default '' check(length(note)<=400),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,sale_id) references public.sales(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
create index payments_sale on public.payments(tenant_id,sale_id);
create index payments_trip on public.payments(tenant_id,trip_id);
create table public.credit_requests (
 tenant_id uuid not null,
 sale_id uuid not null,
 requested_by uuid not null references auth.users(id),
 requested_amount numeric(14,2) not null check(requested_amount>0),
 status text not null check(status in ('pending','approved','rejected','settled')),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 decision_note text not null default '' check(length(decision_note)<=400),
 created_at timestamptz not null default now(),
 primary key(tenant_id,sale_id),
 foreign key(tenant_id,sale_id) references public.sales(tenant_id,id),
 check((status in ('pending','settled') and decided_by is null and decided_at is null)
 or (status in ('approved','rejected') and decided_by is not null and decided_at is not null))
);
create table public.owner_notifications (
 tenant_id uuid not null,
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null,
 sale_id uuid not null,
 kind text not null check(kind in ('delivery','credit_request')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(tenant_id,recipient_id,sale_id,kind),
 foreign key(tenant_id,recipient_id) references public.tenant_members(tenant_id,user_id),
 foreign key(tenant_id,sale_id) references public.sales(tenant_id,id)
);
create index owner_notifications_inbox on public.owner_notifications(tenant_id,recipient_id,created_at);

create function private.commerce_customer_access(t uuid,c uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(t,array['owner']) or
 (private.has_role(t,array['driver']) and exists(
 select 1 from public.inventory_trips r join public.inventory_trip_customers a
 on a.tenant_id=r.tenant_id and a.trip_id=r.id
 where r.tenant_id=t and a.customer_id=c and r.driver_id=auth.uid() and r.status in ('active','submitted')));
$$;
revoke all on function private.commerce_customer_access(uuid,uuid) from public,anon;
grant execute on function private.commerce_customer_access(uuid,uuid) to authenticated;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.credit_requests enable row level security;
alter table public.owner_notifications enable row level security;
create policy sales_read on public.sales for select to authenticated using(private.commerce_customer_access(tenant_id,customer_id));
create policy sale_items_read on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.tenant_id=sale_items.tenant_id and s.id=sale_items.sale_id));
create policy payments_read on public.payments for select to authenticated using(exists(select 1 from public.sales s where s.tenant_id=payments.tenant_id and s.id=payments.sale_id));
create policy credit_requests_read on public.credit_requests for select to authenticated using(exists(select 1 from public.sales s where s.tenant_id=credit_requests.tenant_id and s.id=credit_requests.sale_id));
create policy owner_notifications_read on public.owner_notifications for select to authenticated using(recipient_id=auth.uid() and private.has_role(tenant_id,array['owner']));
revoke all on public.sales,public.sale_items,public.payments,public.credit_requests,public.owner_notifications from public,anon,authenticated;
grant select on public.sales,public.sale_items,public.payments,public.credit_requests,public.owner_notifications to authenticated;

-- Preserve the legacy RPC signature, but all delivery paths now create a charge.
alter function public.inventory_post(uuid,uuid,text,uuid,uuid,jsonb,text) set schema private;
alter function private.inventory_post(uuid,uuid,text,uuid,uuid,jsonb,text) rename to inventory_post_core;
revoke all on function private.inventory_post_core(uuid,uuid,text,uuid,uuid,jsonb,text) from public,anon,authenticated;
create function public.inventory_post(p_tenant uuid,p_id uuid,p_kind text,p_trip uuid,p_customer uuid,p_items jsonb,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; charge numeric; owner_sale boolean;
begin
 result:=private.inventory_post_core(p_tenant,p_id,p_kind,p_trip,p_customer,p_items,p_note);
 if p_kind='delivery' and not exists(select 1 from public.sales where tenant_id=p_tenant and id=p_id) then
  select coalesce(sum(-truck_ready*unit_price),0) into charge from public.inventory_movements where tenant_id=p_tenant and operation_id=p_id;
  insert into public.sales(tenant_id,id,trip_id,customer_id,actor_id,total,occurred_on)
  select p_tenant,p_id,p_trip,p_customer,auth.uid(),charge,occurred_on from public.inventory_operations where tenant_id=p_tenant and id=p_id;
  insert into public.sale_items(tenant_id,sale_id,product_id,product_name,quantity,unit_price)
  select m.tenant_id,p_id,m.product_id,p.name,-m.truck_ready,m.unit_price from public.inventory_movements m
  join public.products p on p.tenant_id=m.tenant_id and p.id=m.product_id
  where m.tenant_id=p_tenant and m.operation_id=p_id and m.truck_ready<0;
  owner_sale:=private.has_role(p_tenant,array['owner']);
  if charge>0 then
   insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status,decided_by,decided_at)
   values(p_tenant,p_id,auth.uid(),charge,case when owner_sale then 'approved' else 'pending' end,case when owner_sale then auth.uid() else null end,case when owner_sale then now() else null end);
  end if;
  if not owner_sale then
   insert into public.owner_notifications(tenant_id,recipient_id,sale_id,kind)
   select p_tenant,m.user_id,p_id,k.kind from public.tenant_members m
   cross join (select 'delivery'::text kind union all select 'credit_request' where charge>0) k
   where m.tenant_id=p_tenant and m.role='owner' and m.active;
  end if;
 end if;
 return result;
end $$;

create function public.commerce_record_payment(p_tenant uuid,p_id uuid,p_sale uuid,p_amount numeric,p_method text,p_date date,p_trip uuid default null,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.sales; previous public.payments; balance numeric;
begin
 if not private.has_role(p_tenant,array['owner','driver']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_amount is null or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
 or p_method is null or p_method not in ('cash','transfer') or p_note is null or length(p_note)>400
 or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Pago inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.payments where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.sale_id=p_sale and previous.amount=p_amount and previous.method=p_method and previous.occurred_on=p_date and previous.trip_id is not distinct from p_trip and previous.note=p_note then return p_id; end if;
  raise exception 'ID de pago ya utilizado con otros datos';
 end if;
 select * into s from public.sales where tenant_id=p_tenant and id=p_sale;
 if not found or not private.commerce_customer_access(p_tenant,s.customer_id) then raise exception 'Venta no accesible' using errcode='42501'; end if;
 if p_date<s.occurred_on then raise exception 'Pago anterior a la venta'; end if;
 if p_trip is not null and not exists(select 1 from public.inventory_trips t join public.inventory_trip_customers a on a.tenant_id=t.tenant_id and a.trip_id=t.id where t.tenant_id=p_tenant and t.id=p_trip and t.status='active' and a.customer_id=s.customer_id and private.inventory_trip_access(p_tenant,t.id)) then raise exception 'Reparto de cobro no válido'; end if;
 if not private.has_role(p_tenant,array['owner']) and p_trip is null then raise exception 'El chofer debe indicar un reparto activo'; end if;
 select s.total-coalesce(sum(amount),0) into balance from public.payments where tenant_id=p_tenant and sale_id=p_sale;
 if p_amount>balance then raise exception 'El pago supera el saldo pendiente'; end if;
 insert into public.payments(tenant_id,id,sale_id,trip_id,actor_id,amount,method,occurred_on,note)
 values(p_tenant,p_id,p_sale,p_trip,auth.uid(),p_amount,p_method,p_date,p_note);
 if p_amount=balance then
  update public.credit_requests set status='settled' where tenant_id=p_tenant and sale_id=p_sale and status='pending';
 end if;
 return p_id;
end $$;

create function public.commerce_deliver(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_items jsonb,p_paid numeric default 0,p_method text default null,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare existing_payment public.payments; previous public.sales;
begin
 if p_paid is null or p_paid<0 or p_paid>999999999999.99 or p_paid<>round(p_paid,2) or (p_paid=0 and p_method is not null) or (p_paid>0 and (p_method is null or p_method not in ('cash','transfer'))) then raise exception 'Cobro inválido'; end if;
 if not private.has_role(p_tenant,array['owner','driver']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.sales where tenant_id=p_tenant and id=p_id;
 if found and (previous.initial_paid is null or previous.initial_paid<>p_paid or previous.initial_method is distinct from p_method) then raise exception 'ID de entrega ya utilizado con otro cobro'; end if;
 perform public.inventory_post(p_tenant,p_id,'delivery',p_trip,p_customer,p_items,p_note);
 update public.sales set initial_paid=p_paid,initial_method=p_method where tenant_id=p_tenant and id=p_id and initial_paid is null;
 -- The delivery ID also identifies its initial payment; retries compare both parts.
 select * into existing_payment from public.payments where tenant_id=p_tenant and id=p_id;
 if found and (p_paid=0 or existing_payment.sale_id<>p_id or existing_payment.amount<>p_paid or existing_payment.method<>p_method) then raise exception 'ID de entrega ya utilizado con otro cobro'; end if;
 if p_paid>0 then
  perform public.commerce_record_payment(p_tenant,p_id,p_id,p_paid,p_method,(select occurred_on from public.sales where tenant_id=p_tenant and id=p_id),p_trip,p_note);
 end if;
 if previous.id is null then
  update public.credit_requests set requested_amount=(select total-p_paid from public.sales where tenant_id=p_tenant and id=p_id)
  where tenant_id=p_tenant and sale_id=p_id and status='pending';
 end if;
 return p_id;
end $$;

create function public.commerce_review_credit(p_tenant uuid,p_sale uuid,p_approve boolean,p_note text default '') returns text
language plpgsql security definer set search_path='' as $$
declare r public.credit_requests; decision text; balance numeric;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede decidir' using errcode='42501'; end if;
 if p_approve is null or p_note is null or length(p_note)>400 then raise exception 'Decisión inválida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into r from public.credit_requests where tenant_id=p_tenant and sale_id=p_sale;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 decision:=case when p_approve then 'approved' else 'rejected' end;
 if r.status=decision and r.decided_by=auth.uid() and r.decision_note=p_note then return decision; end if;
 if r.status<>'pending' then raise exception 'La solicitud ya fue resuelta'; end if;
 select s.total-coalesce((select sum(amount) from public.payments where tenant_id=p_tenant and sale_id=p_sale),0) into balance from public.sales s where s.tenant_id=p_tenant and s.id=p_sale;
 if balance<=0 then raise exception 'La venta ya está pagada'; end if;
 update public.credit_requests set status=decision,decided_by=auth.uid(),decided_at=now(),decision_note=p_note where tenant_id=p_tenant and sale_id=p_sale;
 -- Rejection does not erase the charge and does not charge the driver.
 return decision;
end $$;
create function public.commerce_read_notification(p_tenant uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 update public.owner_notifications set read_at=coalesce(read_at,now()) where tenant_id=p_tenant and id=p_id and recipient_id=auth.uid();
end $$;

create view public.customer_sale_balances with(security_invoker=true) as
 select s.*,s.total-coalesce(p.paid,0) as balance,coalesce(p.paid,0) as paid,
 coalesce(r.status,'none') as credit_status
 from public.sales s left join (select tenant_id,sale_id,sum(amount) paid from public.payments group by tenant_id,sale_id) p on p.tenant_id=s.tenant_id and p.sale_id=s.id
 left join public.credit_requests r on r.tenant_id=s.tenant_id and r.sale_id=s.id;
revoke all on public.customer_sale_balances from public,anon,authenticated;
grant select on public.customer_sale_balances to authenticated;
revoke all on function public.inventory_post(uuid,uuid,text,uuid,uuid,jsonb,text),public.commerce_record_payment(uuid,uuid,uuid,numeric,text,date,uuid,text),public.commerce_deliver(uuid,uuid,uuid,uuid,jsonb,numeric,text,text),public.commerce_review_credit(uuid,uuid,boolean,text),public.commerce_read_notification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.inventory_post(uuid,uuid,text,uuid,uuid,jsonb,text),public.commerce_record_payment(uuid,uuid,uuid,numeric,text,date,uuid,text),public.commerce_deliver(uuid,uuid,uuid,uuid,jsonb,numeric,text,text),public.commerce_review_credit(uuid,uuid,boolean,text),public.commerce_read_notification(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
