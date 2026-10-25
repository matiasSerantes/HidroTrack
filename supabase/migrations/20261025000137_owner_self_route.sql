begin;
create function private.operational_trip_access(t uuid,r uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.accepted_trip_access(t,r) or
 (private.has_role(t,array['owner']) and exists(select 1 from public.inventory_trips x where x.tenant_id=t and x.id=r and x.driver_id=auth.uid() and x.status<>'closed'));
$$;
revoke all on function private.operational_trip_access(uuid,uuid) from public,anon,authenticated;

-- Reuse the audited transaction and read contracts. Only this explicit list
-- gains the self-assigned owner branch; invitation/proposal/legacy gates stay intact.
do $$
declare fn record; definition text;
begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('assistant_open_trip','assistant_customer_visit','assistant_deliver','assistant_record_visit','assistant_customer_debts','assistant_collect_debt') loop
  definition:=pg_get_functiondef(fn.oid);
  if position('private.accepted_trip_access(p_tenant,p_trip)' in definition)=0 then raise exception 'Contrato operativo inesperado'; end if;
  definition:=replace(definition,'private.accepted_trip_access(p_tenant,p_trip)','private.operational_trip_access(p_tenant,p_trip)');
  if position('CREATE OR REPLACE FUNCTION public.assistant_deliver(' in definition)>0 then
   definition:=replace(definition,
    'insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status) values(p_tenant,p_id,auth.uid(),total-p_paid,''pending'');',
    'insert into public.credit_requests(tenant_id,sale_id,requested_by,requested_amount,status,decided_by,decided_at) values(p_tenant,p_id,auth.uid(),total-p_paid,case when private.has_role(p_tenant,array[''owner'']) then ''approved'' else ''pending'' end,case when private.has_role(p_tenant,array[''owner'']) then auth.uid() else null end,case when private.has_role(p_tenant,array[''owner'']) then now() else null end);');
   definition:=replace(definition,'where m.tenant_id=p_tenant and m.role=''owner'' and m.active;', 'where m.tenant_id=p_tenant and m.role=''owner'' and m.active and m.user_id<>auth.uid();');
   definition:=replace(definition,'case when total>p_paid then ''pending'' else ''paid'' end','case when total>p_paid then case when private.has_role(p_tenant,array[''owner'']) then ''approved'' else ''pending'' end else ''paid'' end');
  end if;
  execute definition;
 end loop;
end $$;

create function public.owner_my_trips(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede consultar sus recorridos' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'date',service_date,'status',status) order by service_date,id) from public.inventory_trips where tenant_id=p_tenant and driver_id=auth.uid() and status<>'closed'),'[]'::jsonb);
end $$;
revoke all on function public.owner_my_trips(uuid) from public,anon,authenticated;
grant execute on function public.owner_my_trips(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
