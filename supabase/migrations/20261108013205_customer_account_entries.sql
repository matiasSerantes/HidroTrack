begin;
alter table public.sales drop constraint sales_kind_check;
alter table public.sales add constraint sales_kind_check check(kind in ('delivery','rental','opening','manual'));
alter table public.sales drop constraint sale_source;
alter table public.sales add constraint sale_source check((kind='delivery' and delivery_id=id and delivery_id is not null and trip_id is not null) or(kind in ('rental','opening','manual') and delivery_id is null and trip_id is null and length(trim(description))>0));
alter table public.sales add column manual_details jsonb not null default '[]';
alter table public.sales add column device_recorded_at timestamptz;
alter table public.sales add column device_time_zone text;
alter table public.payments add column device_recorded_at timestamptz;
alter table public.payments add column device_time_zone text;
create table private.customer_account_commands(tenant_id uuid not null,id uuid not null,actor_id uuid not null,request jsonb not null,result jsonb not null,primary key(tenant_id,id));
revoke all on private.customer_account_commands from public,anon,authenticated;
create function public.owner_add_customer_charge(p_tenant uuid,p_id uuid,p_customer uuid,p_amount numeric,p_date date,p_note text,p_product uuid,p_combo uuid,p_quantity integer,p_device_at timestamptz,p_device_zone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous private.customer_account_commands;payload jsonb;details jsonb:='[]';label text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede agregar deuda' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('action','charge','customer',p_customer,'amount',p_amount,'date',p_date,'note',p_note,'product',p_product,'combo',p_combo,'quantity',p_quantity,'device',p_device_at,'zone',p_device_zone);
 select * into previous from private.customer_account_commands where tenant_id=p_tenant and id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return p_id;end if;raise exception 'ID de cargo utilizado con otros datos';end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') or p_date is null or not isfinite(p_date) or p_date<date '1900-01-01' or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(trim(p_note)) not between 1 and 400 or p_quantity is null or p_quantity not between 1 and 100000 or (p_product is not null and p_combo is not null) or p_device_at is null or not isfinite(p_device_at) or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_device_zone) then raise exception 'Cargo, fecha o referencia invalida';end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and removed_at is null) then raise exception 'Cliente no disponible';end if;
 if p_product is not null then
  select name into label from public.products where tenant_id=p_tenant and id=p_product;if not found then raise exception 'Producto no disponible';end if;
  details:=jsonb_build_array(jsonb_build_object('product_id',p_product,'product_name',label,'quantity',p_quantity));
 elsif p_combo is not null then
  select name into label from public.sale_combos where tenant_id=p_tenant and id=p_combo;if not found then raise exception 'Promo no disponible';end if;
  details:=jsonb_build_array(jsonb_build_object('combo_id',p_combo,'product_name',label,'quantity',p_quantity,'unit','promos'));
 end if;
 insert into public.sales(tenant_id,id,customer_id,actor_id,total,occurred_on,kind,description,manual_details,device_recorded_at,device_time_zone)
 values(p_tenant,p_id,p_customer,auth.uid(),p_amount,p_date,'manual',p_note,details,p_device_at,p_device_zone);
 insert into private.customer_account_commands values(p_tenant,p_id,auth.uid(),payload,to_jsonb(p_id));return p_id;
end $$;

create function public.owner_pay_customer_balance(p_tenant uuid,p_id uuid,p_customer uuid,p_amount numeric,p_method text,p_date date,p_note text,p_device_at timestamptz,p_device_zone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.customer_account_commands;payload jsonb;result jsonb;row record;balance numeric;remaining numeric;piece numeric;payment uuid;count integer:=0;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede registrar este pago' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('action','payment','customer',p_customer,'amount',p_amount,'method',p_method,'date',p_date,'note',p_note,'device',p_device_at,'zone',p_device_zone);
 select * into previous from private.customer_account_commands where tenant_id=p_tenant and id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return previous.result;end if;raise exception 'ID de pago utilizado con otros datos';end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') or p_method is null or p_method not in ('cash','transfer') or p_date is null or not isfinite(p_date) or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(p_note)>360 or p_device_at is null or not isfinite(p_device_at) or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_device_zone) then raise exception 'Pago o fecha invalida';end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and removed_at is null) then raise exception 'Cliente no disponible';end if;
 select coalesce(sum(b.balance),0) into balance from public.customer_sale_balances b where b.tenant_id=p_tenant and b.customer_id=p_customer and b.occurred_on<=p_date;
 if p_amount>balance then raise exception 'El pago supera la deuda pendiente a esa fecha';end if;remaining:=p_amount;
 for row in select s.id,s.occurred_on,b.balance from public.sales s join public.customer_sale_balances b on b.tenant_id=s.tenant_id and b.id=s.id where s.tenant_id=p_tenant and s.customer_id=p_customer and b.balance>0 and s.occurred_on<=p_date order by s.occurred_on,s.created_at,s.id loop
  exit when remaining=0;piece:=least(remaining,row.balance);payment:=gen_random_uuid();
  perform public.commerce_record_payment(p_tenant,payment,row.id,piece,p_method,p_date,null,left('Pago a cuenta: '||p_note,400));
  update public.payments set device_recorded_at=p_device_at,device_time_zone=p_device_zone where tenant_id=p_tenant and id=payment;
  remaining:=remaining-piece;count:=count+1;
 end loop;
 select coalesce(sum(b.balance),0) into balance from public.customer_sale_balances b where b.tenant_id=p_tenant and b.customer_id=p_customer;
 result:=jsonb_build_object('id',p_id,'paid',p_amount,'remaining',balance,'charges',count);
 insert into private.customer_account_commands values(p_tenant,p_id,auth.uid(),payload,result);return result;
end $$;
revoke all on function public.owner_add_customer_charge(uuid,uuid,uuid,numeric,date,text,uuid,uuid,integer,timestamptz,text),public.owner_pay_customer_balance(uuid,uuid,uuid,numeric,text,date,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.owner_add_customer_charge(uuid,uuid,uuid,numeric,date,text,uuid,uuid,integer,timestamptz,text),public.owner_pay_customer_balance(uuid,uuid,uuid,numeric,text,date,text,timestamptz,text) to authenticated;

create view public.customer_activity with(security_invoker=true) as
 select tenant_id,customer_id,id,actor_id,trip_id,kind,source,occurred_on,created_at,device_recorded_at,device_time_zone,note,items,'inventory'::text record_type,null::numeric amount from public.inventory_operations where customer_id is not null
 union all select tenant_id,customer_id,id,actor_id,trip_id,kind,null,occurred_on,created_at,device_recorded_at,device_time_zone,description,manual_details,'charge',total from public.sales where kind in ('manual','opening','rental')
 union all select p.tenant_id,s.customer_id,p.id,p.actor_id,p.trip_id,'payment',null,p.occurred_on,p.created_at,p.device_recorded_at,p.device_time_zone,p.note,'[]'::jsonb,'payment',p.amount from public.payments p join public.sales s on s.tenant_id=p.tenant_id and s.id=p.sale_id;
revoke all on public.customer_activity from public,anon,authenticated;
grant select on public.customer_activity to authenticated;
notify pgrst,'reload schema';
commit;
