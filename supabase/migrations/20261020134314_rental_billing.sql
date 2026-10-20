begin;
alter table public.sales drop constraint sales_tenant_id_id_fkey;
alter table public.sales alter column trip_id drop not null;
alter table public.sales add column kind text not null default 'delivery' check(kind in ('delivery','rental','opening'));
alter table public.sales add column delivery_id uuid;
alter table public.sales add column description text not null default '' check(length(description)<=400);
update public.sales set delivery_id=id;
alter table public.sales add foreign key(tenant_id,delivery_id) references public.inventory_operations(tenant_id,id);
alter table public.sales add foreign key(tenant_id,customer_id) references public.customers(tenant_id,id);
alter table public.sales add constraint sale_source check(
 (kind='delivery' and delivery_id is not null and delivery_id=id and trip_id is not null) or
 (kind in ('rental','opening') and delivery_id is null and trip_id is null and length(trim(description))>0));
create function private.sale_delivery_source() returns trigger language plpgsql set search_path='' as $$
begin if new.kind='delivery' then new.delivery_id:=new.id; end if; return new; end $$;
create trigger sale_delivery_source before insert on public.sales for each row execute function private.sale_delivery_source();
revoke all on function private.sale_delivery_source() from public,anon,authenticated;

create table public.rental_charges (
 tenant_id uuid not null,
 sale_id uuid not null,
 assignment_id uuid,
 equipment_id uuid,
 period integer not null check(period between 0 and 1200),
 anchor_date date not null,
 period_start date not null,
 period_end date not null check(period_end>period_start),
 monthly numeric(14,2) not null check(monthly>0),
 primary key(tenant_id,sale_id),
 foreign key(tenant_id,sale_id) references public.sales(tenant_id,id),
 foreign key(tenant_id,assignment_id) references public.dispenser_assignments(tenant_id,id),
 foreign key(tenant_id,equipment_id) references public.dispensers(tenant_id,id),
 check((assignment_id is not null)::integer+(equipment_id is not null)::integer=1)
);
create unique index rental_assignment_period on public.rental_charges(tenant_id,assignment_id,period) where assignment_id is not null;
-- A serialized asset may be assigned again: the anchor distinguishes contracts.
create unique index rental_equipment_period on public.rental_charges(tenant_id,equipment_id,anchor_date,period) where equipment_id is not null;
alter table public.rental_charges enable row level security;
create policy rental_charges_read on public.rental_charges for select to authenticated using(exists(select 1 from public.sales s where s.tenant_id=rental_charges.tenant_id and s.id=rental_charges.sale_id));
revoke all on public.rental_charges from public,anon,authenticated;
grant select on public.rental_charges to authenticated;

create function public.commerce_charge_rental(p_tenant uuid,p_id uuid,p_assignment uuid,p_equipment uuid,p_period integer,p_date date) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.dispenser_assignments; e public.dispensers; prior public.sales; charge public.rental_charges; customer uuid; anchor date; amount numeric; period_start date; period_end date;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede generar cuotas' using errcode='42501'; end if;
 if p_period is null or p_period not between 0 and 1200 or (p_assignment is not null)::integer+(p_equipment is not null)::integer<>1 or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into prior from public.sales where tenant_id=p_tenant and id=p_id;
 if found then
  select * into charge from public.rental_charges where tenant_id=p_tenant and sale_id=p_id;
  if prior.actor_id=auth.uid() and prior.kind='rental' and prior.occurred_on=p_date and charge.assignment_id is not distinct from p_assignment and charge.equipment_id is not distinct from p_equipment and charge.period=p_period then return p_id; end if;
  raise exception 'ID de cargo ya utilizado';
 end if;
 if p_assignment is not null then
  select * into a from public.dispenser_assignments where tenant_id=p_tenant and id=p_assignment and mode='rental' and status='active';
  if not found then raise exception 'Alquiler no activo'; end if;
  customer:=a.customer_id; anchor:=a.occurred_on; amount:=a.monthly;
 else
  select * into e from public.dispensers where tenant_id=p_tenant and id=p_equipment and ownership='company' and mode='rental' and location='customer' and not retired;
  if not found then raise exception 'Equipo no alquilado'; end if;
  customer:=e.customer_id; amount:=e.monthly;
  select d.occurred_on into anchor from public.dispenser_events d where d.tenant_id=p_tenant and d.dispenser_id=p_equipment and d.new_value->>'customer_id'=customer::text and d.new_value->>'mode'='rental'
   and (d.old_value->>'customer_id' is distinct from customer::text or d.old_value->>'mode' is distinct from 'rental') order by d.created_at desc,d.id desc limit 1;
  if anchor is null then raise exception 'Falta fecha de entrega del equipo'; end if;
 end if;
 period_start:=(anchor+make_interval(months=>p_period))::date;
 period_end:=(anchor+make_interval(months=>p_period+1))::date;
 if p_date<period_start then raise exception 'No generar cuotas de períodos futuros'; end if;
 if exists(select 1 from public.rental_charges where tenant_id=p_tenant and period=p_period and
  ((p_assignment is not null and assignment_id=p_assignment) or (p_equipment is not null and equipment_id=p_equipment and anchor_date=anchor))) then raise exception 'La cuota de este período ya fue generada'; end if;
 insert into public.sales(tenant_id,id,customer_id,actor_id,total,occurred_on,kind,description)
 values(p_tenant,p_id,customer,auth.uid(),amount,p_date,'rental','Cuota de alquiler '||period_start::text||' a '||period_end::text);
 insert into public.rental_charges values(p_tenant,p_id,p_assignment,p_equipment,p_period,anchor,period_start,period_end,amount);
 insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status,decided_by,decided_at)
 values(p_tenant,p_id,auth.uid(),amount,'approved',auth.uid(),now());
 return p_id;
end $$;

create function public.commerce_open_customer_balance(p_tenant uuid,p_id uuid,p_customer uuid,p_amount numeric,p_date date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.sales;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede abrir saldos' using errcode='42501'; end if;
 if p_amount is null or p_amount not between 0.01 and 999999999999.99 or p_amount<>round(p_amount,2) or p_date is null or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 400 then raise exception 'Saldo inicial inválido'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.sales where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.kind='opening' and previous.actor_id=auth.uid() and previous.customer_id=p_customer and previous.total=p_amount and previous.occurred_on=p_date and previous.description=p_note then return p_id; end if;
  raise exception 'ID de apertura ya utilizado';
 end if;
 if exists(select 1 from public.sales where tenant_id=p_tenant and customer_id=p_customer) then raise exception 'El cliente ya tiene cuenta corriente; no repetir apertura'; end if;
 insert into public.sales(tenant_id,id,customer_id,actor_id,total,occurred_on,kind,description) values(p_tenant,p_id,p_customer,auth.uid(),p_amount,p_date,'opening',p_note);
 insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status,decided_by,decided_at) values(p_tenant,p_id,auth.uid(),p_amount,'approved',auth.uid(),now());
 return p_id;
end $$;
revoke all on function public.commerce_charge_rental(uuid,uuid,uuid,uuid,integer,date),public.commerce_open_customer_balance(uuid,uuid,uuid,numeric,date,text) from public,anon,authenticated;
grant execute on function public.commerce_charge_rental(uuid,uuid,uuid,uuid,integer,date),public.commerce_open_customer_balance(uuid,uuid,uuid,numeric,date,text) to authenticated;
create function private.inventory_invoice_identity_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.sales where tenant_id=new.tenant_id and id=new.id and kind<>'delivery') then raise exception 'ID de operación reservado por un cargo comercial'; end if;
 return new;
end $$;
create trigger inventory_invoice_identity_guard before insert on public.inventory_operations for each row execute function private.inventory_invoice_identity_guard();
revoke all on function private.inventory_invoice_identity_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
