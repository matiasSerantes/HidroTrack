begin;
create table private.license_payments(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),company_name text not null,plan text not null check(plan in ('basic','intermediate','unlimited','custom')),plan_name text not null,
 amount numeric(14,2) not null check(amount>0 and amount<=999999999999.99),kind text not null check(kind in ('purchase','renewal')),method text not null check(method in ('cash','transfer','other')),paid_on date not null,reference text not null default '' check(length(reference)<=360),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),voided boolean not null default false,version integer not null default 1,voided_by uuid references auth.users(id),voided_at timestamptz,
 check((not voided and voided_by is null and voided_at is null) or(voided and voided_by is not null and voided_at is not null)));
create index license_payments_month on private.license_payments(paid_on desc,created_at desc,id);
create table private.license_payment_commands(id uuid primary key,actor_id uuid not null references auth.users(id),request jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table private.license_payments enable row level security;
alter table private.license_payment_commands enable row level security;
revoke all on private.license_payments,private.license_payment_commands from public,anon,authenticated;
create function public.admin_record_license_payment(p_id uuid,p_tenant uuid,p_plan text,p_amount numeric,p_kind text,p_method text,p_paid_on date,p_reference text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.license_payment_commands;payload jsonb;result jsonb;company text;label text;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('action','record','tenant',p_tenant,'plan',p_plan,'amount',p_amount,'kind',p_kind,'method',p_method,'paid_on',p_paid_on,'reference',p_reference);
 select * into previous from private.license_payment_commands where id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return previous.result;end if;raise exception 'ID de cobro usado con otros datos';end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') or p_kind is null or p_kind not in ('purchase','renewal') or p_method is null or p_method not in ('cash','transfer','other') or p_paid_on is null or not isfinite(p_paid_on) or p_paid_on<date '2000-01-01' or p_paid_on>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_reference is null or length(p_reference)>360 then raise exception 'Revisa importe, tipo, fecha y referencia';end if;
 select name into company from public.tenants where id=p_tenant;if not found then raise exception 'Empresa no disponible';end if;
 select name into label from public.license_plan_catalog where plan=p_plan;
 if p_plan='custom' then label:='Personalizado';elsif label is null then raise exception 'Plan no disponible';end if;
 insert into private.license_payments(id,tenant_id,company_name,plan,plan_name,amount,kind,method,paid_on,reference,created_by) values(p_id,p_tenant,company,p_plan,label,p_amount,p_kind,p_method,p_paid_on,p_reference,auth.uid());
 result:=jsonb_build_object('id',p_id,'version',1,'paid_on',p_paid_on,'amount',p_amount);
 insert into private.license_payment_commands(id,actor_id,request,result) values(p_id,auth.uid(),payload,result);return result;
end $$;
create function public.admin_set_license_payment_void(p_id uuid,p_payment uuid,p_expected_version integer,p_voided boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.license_payment_commands;payload jsonb;payment private.license_payments;result jsonb;t uuid;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 select tenant_id into t from private.license_payments where id=p_payment;perform 1 from public.tenants where id=t for update;
 payload:=jsonb_build_object('action','void','payment',p_payment,'version',p_expected_version,'voided',p_voided);
 select * into previous from private.license_payment_commands where id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return previous.result;end if;raise exception 'ID de cambio usado con otros datos';end if;
 select * into payment from private.license_payments where id=p_payment for update;if not found then raise exception 'Cobro no disponible';end if;
 if p_id is null or p_voided is null or p_expected_version is distinct from payment.version then raise exception 'El cobro cambio; actualiza antes de modificar';end if;
 if p_voided=payment.voided then raise exception 'El cobro ya tiene ese estado';end if;
 update private.license_payments set voided=p_voided,version=version+1,voided_by=case when p_voided then auth.uid() end,voided_at=case when p_voided then now() end where id=p_payment;
 result:=jsonb_build_object('id',p_payment,'voided',p_voided,'version',payment.version+1);
 insert into private.license_payment_commands(id,actor_id,request,result) values(p_id,auth.uid(),payload,result);return result;
end $$;
create function public.admin_license_income(p_month date default date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare next_month date;result jsonb;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 if p_month is null or not isfinite(p_month) or p_month<date '2000-01-01' or p_month>date '2100-12-01' or extract(day from p_month)<>1 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Mes o pagina invalida';end if;
 next_month:=(p_month+interval '1 month')::date;
 with paid as materialized(select * from private.license_payments where not voided and paid_on>=p_month and paid_on<next_month),
 plans as(select plan,name,monthly_price from public.license_plan_catalog union all select 'custom','Personalizado',null::numeric),
 ranked as(select p.plan,p.name,coalesce(sum(x.amount),0) amount,count(x.id) filter(where x.kind='purchase') purchases,count(x.id) filter(where x.kind='renewal') renewals from plans p left join paid x on x.plan=p.plan group by p.plan,p.name)
 select jsonb_build_object('month',to_char(p_month,'YYYY-MM'),'currency','ARS','total',coalesce((select sum(amount) from paid),0),'purchases',(select count(*) from paid where kind='purchase'),'renewals',(select count(*) from paid where kind='renewal'),'paying_companies',(select count(distinct tenant_id) from paid),
 'ranking',(select jsonb_agg(to_jsonb(r) order by r.purchases desc,r.renewals desc,r.amount desc,r.plan) from ranked r),
 'plans',(select jsonb_agg(to_jsonb(p) order by p.plan) from plans p),
 'trend',(select jsonb_agg(jsonb_build_object('month',to_char(m,'YYYY-MM'),'total',coalesce((select sum(amount) from private.license_payments where not voided and paid_on>=m::date and paid_on<(m+interval '1 month')::date),0)) order by m) from generate_series(p_month::timestamp-interval '5 months',p_month::timestamp,interval '1 month') m),
 'count',(select count(*) from private.license_payments where paid_on>=p_month and paid_on<next_month),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_on desc,p.created_at desc,p.id) from(select id,tenant_id,company_name,plan,plan_name,amount,kind,method,paid_on,reference,voided,version,created_by,created_at,voided_by,voided_at from private.license_payments where paid_on>=p_month and paid_on<next_month order by paid_on desc,created_at desc,id limit 20 offset p_offset) p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.admin_record_license_payment(uuid,uuid,text,numeric,text,text,date,text),public.admin_set_license_payment_void(uuid,uuid,integer,boolean),public.admin_license_income(date,integer) from public,anon,authenticated;
grant execute on function public.admin_record_license_payment(uuid,uuid,text,numeric,text,text,date,text),public.admin_set_license_payment_void(uuid,uuid,integer,boolean),public.admin_license_income(date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
