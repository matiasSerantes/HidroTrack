begin;
create function public.assistant_record_visit(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_version integer,p_outcome text,p_followup text default null,p_next_date date default null,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare stop public.route_stops; previous public.route_events; payload jsonb; service_date date; day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_outcome is null or p_outcome not in ('absent','no_purchase') or p_note is null or length(p_note)>400 then raise exception 'Visita invalida'; end if;
 payload:=jsonb_build_object('outcome',p_outcome,'expected_version',p_version,'followup',p_followup,'next_date',p_next_date,'note',p_note);
 select * into previous from public.route_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.customer_id=p_customer and previous.action=p_outcome and previous.data-'result_version'=payload then
   return jsonb_build_object('id',p_id,'version',previous.data->'result_version','outcome',p_outcome,'next_date',p_next_date);
  end if;
  raise exception 'ID de visita utilizado con otros datos';
 end if;
 select t.service_date into service_date from public.inventory_trips t where tenant_id=p_tenant and id=p_trip and status='active';
 if not found then raise exception 'Reparto no activo'; end if;
 if p_outcome='absent' then
  if p_followup is null or p_followup not in ('later_today','date') or p_next_date is null or p_next_date<service_date or (p_followup='later_today' and p_next_date<>day) or (p_followup='date' and p_next_date<=day) then raise exception 'Elegi hoy mas tarde u otro dia futuro'; end if;
 elsif p_followup is not null or p_next_date is not null then raise exception 'No compro no reprograma la visita'; end if;
 select * into stop from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer and active for update;
 if not found or not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no asignado o inactivo' using errcode='42501'; end if;
 if stop.version<>p_version or stop.outcome in ('delivered','no_purchase') then raise exception 'La parada cambio o ya esta resuelta'; end if;
 update public.route_stops set outcome=p_outcome,followup=p_followup,next_date=p_next_date,version=version+1,updated_at=now() where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer returning * into stop;
 insert into public.route_events(tenant_id,id,trip_id,customer_id,actor_id,action,data) values(p_tenant,p_id,p_trip,p_customer,auth.uid(),p_outcome,payload||jsonb_build_object('result_version',stop.version));
 return jsonb_build_object('id',p_id,'version',stop.version,'outcome',p_outcome,'next_date',p_next_date);
end $$;

create function public.assistant_customer_debts(p_tenant uuid,p_trip uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.accepted_trip_access(p_tenant,p_trip) or not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no aceptado o no activo' using errcode='42501'; end if;
 if not exists(select 1 from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id where r.tenant_id=p_tenant and r.trip_id=p_trip and r.customer_id=p_customer and r.active and c.active) then raise exception 'Cliente no asignado o inactivo' using errcode='42501'; end if;
 return (with debts as (
  select s.id,s.kind,s.description,s.occurred_on,s.total,coalesce(r.status,'unreviewed') credit_status,s.total-coalesce((select sum(p.amount) from public.payments p where p.tenant_id=s.tenant_id and p.sale_id=s.id),0) balance
  from public.sales s left join public.credit_requests r on r.tenant_id=s.tenant_id and r.sale_id=s.id where s.tenant_id=p_tenant and s.customer_id=p_customer
 ) select jsonb_build_object('count',(select count(*) from debts where balance>0),'balance',(select coalesce(sum(balance),0) from debts),'items',coalesce((select jsonb_agg(to_jsonb(v) order by v.occurred_on,v.id) from (select * from debts where balance>0 order by occurred_on,id limit 20) v),'[]'::jsonb)));
end $$;

create table public.assistant_payment_receipts (
 tenant_id uuid not null,
 id uuid not null,
 actor_id uuid not null references auth.users(id),
 trip_id uuid not null,
 customer_id uuid not null,
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,id) references public.payments(tenant_id,id),
 foreign key(tenant_id,trip_id,customer_id) references public.inventory_trip_customers(tenant_id,trip_id,customer_id)
);
alter table public.assistant_payment_receipts enable row level security;
create policy assistant_payment_receipts_owner on public.assistant_payment_receipts for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.assistant_payment_receipts from public,anon,authenticated;
grant select on public.assistant_payment_receipts to authenticated;

create function public.assistant_collect_debt(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_sale uuid,p_expected_balance numeric,p_amount numeric,p_method text,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.assistant_payment_receipts; sale public.sales; balance numeric; payload jsonb; receipt jsonb; day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 payload:=jsonb_build_object('sale',p_sale,'expected_balance',p_expected_balance,'amount',p_amount,'method',p_method,'note',p_note);
 select * into previous from public.assistant_payment_receipts where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.customer_id=p_customer and previous.request=payload then return previous.result; end if;
  raise exception 'ID de cobro utilizado con otros datos';
 end if;
 if p_id is null or p_sale is null or p_expected_balance is null or p_expected_balance<=0 or p_expected_balance>999999999999.99 or p_expected_balance<>round(p_expected_balance,2) or p_amount is null or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2) or p_method is null or p_method not in ('cash','transfer') or p_note is null or length(p_note)>400 then raise exception 'Cobro invalido'; end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no activo'; end if;
 if not exists(select 1 from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id where r.tenant_id=p_tenant and r.trip_id=p_trip and r.customer_id=p_customer and r.active and c.active) then raise exception 'Cliente no asignado o inactivo' using errcode='42501'; end if;
 select * into sale from public.sales where tenant_id=p_tenant and id=p_sale and customer_id=p_customer for update;
 if not found then raise exception 'Cargo no accesible' using errcode='42501'; end if;
 if sale.occurred_on>day then raise exception 'El cargo tiene fecha futura'; end if;
 select sale.total-coalesce(sum(amount),0) into balance from public.payments where tenant_id=p_tenant and sale_id=p_sale;
 if balance<>p_expected_balance then raise exception 'El saldo cambio; actualiza los cargos del cliente'; end if;
 if p_amount>balance then raise exception 'El cobro supera el saldo de ese cargo'; end if;
 if exists(select 1 from public.payments where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.sales where tenant_id=p_tenant and id=p_id) or exists(select 1 from public.inventory_operations where tenant_id=p_tenant and id=p_id) then raise exception 'ID de operacion utilizado'; end if;
 insert into public.payments(tenant_id,id,sale_id,trip_id,actor_id,amount,method,occurred_on,note) values(p_tenant,p_id,p_sale,p_trip,auth.uid(),p_amount,p_method,day,p_note);
 if p_amount=balance then update public.credit_requests set status='settled' where tenant_id=p_tenant and sale_id=p_sale and status='pending'; end if;
 receipt:=jsonb_build_object('id',p_id,'sale_id',p_sale,'amount',p_amount,'remaining',balance-p_amount);
 insert into public.assistant_payment_receipts(tenant_id,id,actor_id,trip_id,customer_id,request,result) values(p_tenant,p_id,auth.uid(),p_trip,p_customer,payload,receipt);
 return receipt;
end $$;
revoke all on function public.assistant_record_visit(uuid,uuid,uuid,uuid,integer,text,text,date,text),public.assistant_customer_debts(uuid,uuid,uuid),public.assistant_collect_debt(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text) from public,anon,authenticated;
grant execute on function public.assistant_record_visit(uuid,uuid,uuid,uuid,integer,text,text,date,text),public.assistant_customer_debts(uuid,uuid,uuid),public.assistant_collect_debt(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
