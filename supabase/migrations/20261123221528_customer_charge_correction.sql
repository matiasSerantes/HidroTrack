begin;
create table public.customer_charge_corrections(
 tenant_id uuid not null,id uuid not null,customer_id uuid not null,sale_id uuid not null,actor_id uuid not null references auth.users(id),old_total numeric not null,new_total numeric not null,paid numeric not null,note text not null default '',request jsonb not null,created_at timestamptz not null default now(),device_recorded_at timestamptz not null,device_time_zone text not null,
 primary key(tenant_id,id),foreign key(tenant_id,sale_id) references public.sales(tenant_id,id),foreign key(tenant_id,customer_id) references public.customers(tenant_id,id)
);
alter table public.customer_charge_corrections enable row level security;
revoke all on public.customer_charge_corrections from public,anon,authenticated;
grant select on public.customer_charge_corrections to authenticated;
create policy charge_corrections_owner on public.customer_charge_corrections for select to authenticated using(private.has_role(tenant_id,array['owner']));
create function public.owner_correct_customer_charge(p_tenant uuid,p_id uuid,p_customer uuid,p_sale uuid,p_expected_total numeric,p_expected_paid numeric,p_total numeric,p_note text,p_device_at timestamptz,p_device_zone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior public.customer_charge_corrections;sale public.sales;paid numeric;payload jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede corregir deuda' using errcode='42501';end if;
 if p_id is null or p_total is null or p_total<0 or p_total>999999999999.99 or p_total<>round(p_total,2) or p_total::text in ('NaN','Infinity','-Infinity') or p_expected_total is null or p_expected_paid is null or p_note is null or length(p_note)>400 or p_device_at is null or not isfinite(p_device_at) or p_device_at<timestamptz '1900-01-01 UTC' or p_device_at>=timestamptz '2200-01-01 UTC' or p_device_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_device_zone) then raise exception 'Correccion invalida';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('customer',p_customer,'sale',p_sale,'expected_total',p_expected_total,'expected_paid',p_expected_paid,'total',p_total,'note',p_note,'device',p_device_at,'zone',p_device_zone);
 select * into prior from public.customer_charge_corrections where tenant_id=p_tenant and id=p_id;
 if found then if prior.actor_id=auth.uid() and prior.request=payload then return p_id;end if;raise exception 'ID usado con otros datos';end if;
 select * into sale from public.sales where tenant_id=p_tenant and id=p_sale and customer_id=p_customer for update;
 if not found or sale.kind not in ('manual','opening') then raise exception 'Solo se corrigen deudas cargadas manualmente';end if;
 select coalesce(sum(amount),0) into paid from public.payments where tenant_id=p_tenant and sale_id=p_sale;
 if sale.total<>p_expected_total or paid<>p_expected_paid then raise exception 'La deuda o sus pagos cambiaron. Actualiza la cuenta';end if;
 if p_total<paid then raise exception 'El total correcto no puede ser menor a lo ya pagado';end if;
 if p_total=sale.total then raise exception 'Ingresa un importe diferente';end if;
 insert into public.customer_charge_corrections(tenant_id,id,customer_id,sale_id,actor_id,old_total,new_total,paid,note,request,device_recorded_at,device_time_zone) values(p_tenant,p_id,p_customer,p_sale,auth.uid(),sale.total,p_total,paid,p_note,payload,p_device_at,p_device_zone);
 update public.sales set total=p_total where tenant_id=p_tenant and id=p_sale;
 return p_id;
end $$;
revoke all on function public.owner_correct_customer_charge(uuid,uuid,uuid,uuid,numeric,numeric,numeric,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.owner_correct_customer_charge(uuid,uuid,uuid,uuid,numeric,numeric,numeric,text,timestamptz,text) to authenticated;
notify pgrst,'reload schema';
commit;
