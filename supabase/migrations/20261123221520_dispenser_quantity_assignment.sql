begin;
create table private.dispenser_quantity_receipts(
 tenant_id uuid not null references public.tenants(id),id uuid not null,actor_id uuid not null,request jsonb not null,assignments uuid[] not null,primary key(tenant_id,id)
);
alter table private.dispenser_quantity_receipts enable row level security;
revoke all on private.dispenser_quantity_receipts from public,anon,authenticated;
create function public.owner_assign_dispenser_quantity(p_tenant uuid,p_id uuid,p_customer uuid,p_product uuid,p_quantity integer,p_mode text,p_monthly numeric,p_date date,p_trip uuid,p_terms text) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior private.dispenser_quantity_receipts;payload jsonb;unit_id uuid;ids uuid[]:='{}';i integer;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede asignar dispenser' using errcode='42501';end if;
 if p_id is null or p_quantity is null or p_quantity not between 1 and 1000 or p_mode is null or p_mode not in ('loan','rental') or p_monthly is null or p_terms is null or length(p_terms)>1000 or (p_mode='loan' and p_monthly<>0) then raise exception 'Cantidad o modalidad invalida';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('customer',p_customer,'product',p_product,'quantity',p_quantity,'mode',p_mode,'monthly',p_monthly,'date',p_date,'trip',p_trip,'terms',p_terms);
 select * into prior from private.dispenser_quantity_receipts where tenant_id=p_tenant and id=p_id;
 if found then if prior.actor_id=auth.uid() and prior.request=payload then return p_id;end if;raise exception 'ID de asignacion usado con otros datos';end if;
 for i in 1..p_quantity loop
  unit_id:=case when i=1 then p_id else gen_random_uuid() end;
  if p_mode='rental' then
   perform public.owner_assign_rental_agreement(p_tenant,unit_id,gen_random_uuid(),p_customer,p_product,null,p_monthly,p_date,p_trip,p_terms);
  else
   perform public.inventory_assign_dispenser_model(p_tenant,unit_id,p_product,p_customer,p_mode,p_monthly,p_date,p_trip);
  end if;
  ids:=array_append(ids,unit_id);
 end loop;
 insert into private.dispenser_quantity_receipts values(p_tenant,p_id,auth.uid(),payload,ids);
 return p_id;
end $$;
revoke all on function public.owner_assign_dispenser_quantity(uuid,uuid,uuid,uuid,integer,text,numeric,date,uuid,text) from public,anon,authenticated;
grant execute on function public.owner_assign_dispenser_quantity(uuid,uuid,uuid,uuid,integer,text,numeric,date,uuid,text) to authenticated;
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.owner_customer_sheet_command(uuid,uuid,text,jsonb,timestamptz,text)'::regprocedure);
 if position('''inventory_assign_dispenser_model''' in definition)=0 then raise exception 'Unexpected customer command contract';end if;
 execute replace(definition,'''inventory_assign_dispenser_model''','''owner_assign_dispenser_quantity'',''inventory_assign_dispenser_model''');
end $$;
notify pgrst,'reload schema';
commit;
