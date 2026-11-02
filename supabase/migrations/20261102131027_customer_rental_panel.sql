begin;
create table public.rental_agreement_changes(
 tenant_id uuid not null,id uuid not null,sequence bigint generated always as identity,
 customer_id uuid not null,source text not null check(source in ('assignment','equipment')),reference_id uuid not null,anchor_date date not null,
 previous_monthly numeric(14,2) not null,monthly numeric(14,2) not null check(monthly>0),previous_terms text not null,terms text not null check(length(terms)<=1000),
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id)
);
create index rental_agreement_current on public.rental_agreement_changes(tenant_id,source,reference_id,anchor_date,sequence desc);
alter table public.rental_agreement_changes enable row level security;
create policy rental_agreement_owner on public.rental_agreement_changes for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.rental_agreement_changes from public,anon,authenticated;
grant select on public.rental_agreement_changes to authenticated;
create table private.rental_assignment_requests(tenant_id uuid not null references public.tenants(id),id uuid not null,actor_id uuid not null references auth.users(id),payload jsonb not null,result uuid not null,primary key(tenant_id,id));
revoke all on private.rental_assignment_requests from public,anon,authenticated;
create function private.customer_rental_contracts(t uuid,c uuid) returns table(source text,reference_id uuid,label text,monthly numeric,anchor date)
language sql stable security definer set search_path='' as $$
 select 'assignment',a.id,p.name,a.monthly,a.occurred_on from public.dispenser_assignments a join public.products p on p.tenant_id=a.tenant_id and p.id=a.product_id
 where a.tenant_id=t and a.customer_id=c and a.status='active' and a.mode='rental' and a.monthly>0
 union all
 select 'equipment',e.id,e.name||case when e.serial<>'' then ' · '||e.serial else '' end,e.monthly,d.occurred_on
 from public.dispensers e left join lateral (
 select v.occurred_on from public.dispenser_events v where v.tenant_id=e.tenant_id and v.dispenser_id=e.id and v.new_value->>'customer_id'=c::text and v.new_value->>'mode'='rental'
 and (v.old_value->>'customer_id' is distinct from c::text or v.old_value->>'mode' is distinct from 'rental') order by v.created_at desc,v.id desc limit 1) d on true
 where e.tenant_id=t and e.customer_id=c and e.ownership='company' and e.location='customer' and not e.retired and e.mode='rental' and e.monthly>0;
$$;
revoke all on function private.customer_rental_contracts(uuid,uuid) from public,anon,authenticated;
create function public.owner_customer_rentals(p_tenant uuid,p_customer uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;contract record;next_period integer;contracts jsonb:='[]'::jsonb;history jsonb;terms text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede consultar alquileres' using errcode='42501';end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer) then raise exception 'Cliente no encontrado';end if;
 for contract in select * from private.customer_rental_contracts(p_tenant,p_customer) order by label,reference_id loop
  next_period:=null;
  if contract.anchor is not null and isfinite(contract.anchor) and contract.anchor<=today then
   select min(g.period) into next_period from generate_series(0,least(1200,((extract(year from today)-extract(year from contract.anchor))*12+extract(month from today)-extract(month from contract.anchor))::integer)) g(period)
   where (contract.anchor+make_interval(months=>g.period))::date<=today and not exists(select 1 from public.rental_charges q where q.tenant_id=p_tenant and q.anchor_date=contract.anchor and q.period=g.period and ((contract.source='assignment' and q.assignment_id=contract.reference_id) or (contract.source='equipment' and q.equipment_id=contract.reference_id)));
  end if;
  select a.terms into terms from public.rental_agreement_changes a where a.tenant_id=p_tenant and a.source=contract.source and a.reference_id=contract.reference_id and a.anchor_date=contract.anchor order by a.sequence desc limit 1;
  contracts:=contracts||jsonb_build_array(jsonb_build_object('source',contract.source,'id',contract.reference_id,'label',contract.label,'monthly',contract.monthly,'anchor',case when isfinite(contract.anchor) then contract.anchor end,'next_period',next_period,
   'terms',coalesce(terms,''),
   'period_start',case when next_period is not null then (contract.anchor+make_interval(months=>next_period))::date end,
   'period_end',case when next_period is not null then (contract.anchor+make_interval(months=>next_period+1))::date end));
 end loop;
 select coalesce(jsonb_agg(to_jsonb(v) order by v.period_start desc,v.sale_id),'[]'::jsonb) into history from (
 select r.sale_id,r.period_start,r.period_end,r.monthly,s.occurred_on from public.rental_charges r join public.sales s on s.tenant_id=r.tenant_id and s.id=r.sale_id where s.tenant_id=p_tenant and s.customer_id=p_customer order by r.period_start desc,r.sale_id limit 50) v;
 return jsonb_build_object('as_of',today,'contracts',contracts,'charges',history);
end $$;
create function public.owner_edit_rental_agreement(p_tenant uuid,p_id uuid,p_customer uuid,p_source text,p_reference uuid,p_anchor date,p_expected_monthly numeric,p_expected_terms text,p_monthly numeric,p_terms text) returns uuid
language plpgsql security definer set search_path='' as $$
declare contract record;prior public.rental_agreement_changes;old_terms text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede editar alquileres' using errcode='42501';end if;
 if p_id is null or p_source not in ('assignment','equipment') or p_anchor is null or not isfinite(p_anchor) or p_monthly is null or p_monthly not between 0.01 and 999999999999.99 or p_monthly<>round(p_monthly,2) or p_terms is null or length(p_terms)>1000 or p_expected_terms is null then raise exception 'Revisa importe y condiciones del alquiler';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into prior from public.rental_agreement_changes where tenant_id=p_tenant and id=p_id;
 if found then
  if prior.actor_id=auth.uid() and prior.customer_id=p_customer and prior.source=p_source and prior.reference_id=p_reference and prior.anchor_date=p_anchor and prior.previous_monthly=p_expected_monthly and prior.previous_terms=p_expected_terms and prior.monthly=p_monthly and prior.terms=p_terms then return p_id;end if;
  raise exception 'ID de acuerdo ya utilizado';
 end if;
 select * into contract from private.customer_rental_contracts(p_tenant,p_customer) where source=p_source and reference_id=p_reference;
 if not found or contract.anchor is distinct from p_anchor or contract.monthly is distinct from p_expected_monthly then raise exception 'El alquiler cambio; actualiza la planilla';end if;
 select a.terms into old_terms from public.rental_agreement_changes a where a.tenant_id=p_tenant and a.source=p_source and a.reference_id=p_reference and a.anchor_date=p_anchor order by a.sequence desc limit 1;
 old_terms:=coalesce(old_terms,'');if old_terms is distinct from p_expected_terms then raise exception 'El acuerdo cambio; actualiza la planilla';end if;
 if p_source='assignment' then update public.dispenser_assignments set monthly=p_monthly where tenant_id=p_tenant and id=p_reference;
 else update public.dispensers set monthly=p_monthly,updated_at=now() where tenant_id=p_tenant and id=p_reference;end if;
 insert into public.rental_agreement_changes(tenant_id,id,customer_id,source,reference_id,anchor_date,previous_monthly,monthly,previous_terms,terms,actor_id)
 values(p_tenant,p_id,p_customer,p_source,p_reference,p_anchor,p_expected_monthly,p_monthly,old_terms,p_terms,auth.uid());
 return p_id;
end $$;
create function public.owner_charge_rental_period(p_tenant uuid,p_id uuid,p_customer uuid,p_assignment uuid,p_equipment uuid,p_period integer,p_date date,p_expected_anchor date,p_expected_monthly numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare contract record;prior public.sales;charge public.rental_charges;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede generar cuotas' using errcode='42501';end if;
 if p_id is null or p_expected_anchor is null or not isfinite(p_expected_anchor) or p_expected_monthly is null or p_expected_monthly<=0 or (p_assignment is not null)::integer+(p_equipment is not null)::integer<>1 then raise exception 'Contrato de alquiler invalido';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into prior from public.sales where tenant_id=p_tenant and id=p_id;
 if found then
  select * into charge from public.rental_charges where tenant_id=p_tenant and sale_id=p_id;
  if prior.actor_id=auth.uid() and prior.kind='rental' and prior.customer_id=p_customer and prior.occurred_on=p_date and charge.assignment_id is not distinct from p_assignment and charge.equipment_id is not distinct from p_equipment and charge.period=p_period and charge.anchor_date=p_expected_anchor and charge.monthly=p_expected_monthly then return p_id;end if;
  raise exception 'ID de cuota ya utilizado';
 end if;
 select * into contract from private.customer_rental_contracts(p_tenant,p_customer) where (source='assignment' and reference_id=p_assignment) or (source='equipment' and reference_id=p_equipment);
 if not found or contract.anchor is distinct from p_expected_anchor or contract.monthly is distinct from p_expected_monthly then raise exception 'El alquiler cambio; actualiza la planilla antes de generar la cuota';end if;
 return public.commerce_charge_rental(p_tenant,p_id,p_assignment,p_equipment,p_period,p_date);
end $$;
create function public.owner_assign_rental_agreement(p_tenant uuid,p_id uuid,p_agreement uuid,p_customer uuid,p_product uuid,p_equipment uuid,p_monthly numeric,p_date date,p_trip uuid,p_terms text) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior private.rental_assignment_requests;payload jsonb;equipment public.dispensers;reference uuid;contract_source text;contract record;terms text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede acordar alquileres' using errcode='42501';end if;
 if p_id is null or p_agreement is null or (p_product is not null)::integer+(p_equipment is not null)::integer<>1 or p_terms is null or length(p_terms)>1000 then raise exception 'Acuerdo invalido';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('agreement',p_agreement,'customer',p_customer,'product',p_product,'equipment',p_equipment,'monthly',p_monthly,'date',p_date,'trip',p_trip,'terms',p_terms);
 select * into prior from private.rental_assignment_requests where tenant_id=p_tenant and id=p_id;
 if found then if prior.actor_id=auth.uid() and prior.payload=payload then return prior.result;end if;raise exception 'ID de asignacion ya utilizado';end if;
 if p_product is not null then
  reference:=public.inventory_assign_dispenser_model(p_tenant,p_id,p_product,p_customer,'rental',p_monthly,p_date,p_trip);contract_source:='assignment';
 else
  select * into equipment from public.dispensers where tenant_id=p_tenant and id=p_equipment and ownership='company' and location='depot' and not retired for update;
  if not found then raise exception 'Dispenser no disponible';end if;
  reference:=public.inventory_save_dispenser(p_tenant,p_id,p_equipment,equipment.name,equipment.serial,'company','customer',p_customer,null,'rental',p_monthly);contract_source:='equipment';
 end if;
 select * into contract from private.customer_rental_contracts(p_tenant,p_customer) c where c.source=contract_source and c.reference_id=reference;
 if not found or contract.anchor is null then raise exception 'No se pudo confirmar el contrato de alquiler';end if;
 select a.terms into terms from public.rental_agreement_changes a where a.tenant_id=p_tenant and a.source=contract_source and a.reference_id=reference and a.anchor_date=contract.anchor order by a.sequence desc limit 1;
 perform public.owner_edit_rental_agreement(p_tenant,p_agreement,p_customer,contract_source,reference,contract.anchor,contract.monthly,coalesce(terms,''),p_monthly,p_terms);
 insert into private.rental_assignment_requests values(p_tenant,p_id,auth.uid(),payload,reference);
 return reference;
end $$;
revoke all on function public.owner_assign_rental_agreement(uuid,uuid,uuid,uuid,uuid,uuid,numeric,date,uuid,text) from public,anon,authenticated;
grant execute on function public.owner_assign_rental_agreement(uuid,uuid,uuid,uuid,uuid,uuid,numeric,date,uuid,text) to authenticated;
revoke all on function public.owner_customer_rentals(uuid,uuid),public.owner_charge_rental_period(uuid,uuid,uuid,uuid,uuid,integer,date,date,numeric),public.owner_edit_rental_agreement(uuid,uuid,uuid,text,uuid,date,numeric,text,numeric,text) from public,anon,authenticated;
grant execute on function public.owner_customer_rentals(uuid,uuid),public.owner_charge_rental_period(uuid,uuid,uuid,uuid,uuid,integer,date,date,numeric),public.owner_edit_rental_agreement(uuid,uuid,uuid,text,uuid,date,numeric,text,numeric,text) to authenticated;
notify pgrst,'reload schema';
commit;
