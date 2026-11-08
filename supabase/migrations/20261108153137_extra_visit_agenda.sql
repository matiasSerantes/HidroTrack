begin;
alter table public.extra_visit_requests add column requested_time time check(requested_time is null or(requested_time>=time '00:00' and requested_time<time '24:00' and extract(second from requested_time)=0));
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.owner_request_extra_visit(uuid,uuid,uuid,date,jsonb,text)'::regprocedure);
 definition:=replace(definition,'p_note text DEFAULT ', 'p_time time without time zone, p_note text DEFAULT ');
 definition:=replace(definition,'owner_request_extra_visit(', 'owner_request_extra_visit_at(');
 if position('previous.note=p_note' in definition)=0 then raise exception 'Contrato de pedido inesperado';end if;
 definition:=replace(definition,'previous.note=p_note','previous.requested_time is not distinct from p_time and previous.note=p_note');
 definition:=replace(definition,'if p_id is null or p_date is null','if (p_time is not null and (p_time>=time ''24:00'' or extract(second from p_time)<>0)) or p_id is null or p_date is null or not isfinite(p_date)');
 definition:=replace(definition,'requested_on,items,note,actor_id) values(p_id,p_tenant,p_customer,p_date,p_items,p_note,auth.uid())','requested_on,items,note,actor_id,requested_time) values(p_id,p_tenant,p_customer,p_date,p_items,p_note,auth.uid(),p_time)');
 if position('p_time time' in definition)=0 or position('actor_id,requested_time)' in definition)=0 then raise exception 'Contrato de hora inesperado';end if;
 execute definition;
end $$;
revoke all on function public.owner_request_extra_visit_at(uuid,uuid,uuid,date,jsonb,time,text) from public,anon,authenticated;
grant execute on function public.owner_request_extra_visit_at(uuid,uuid,uuid,date,jsonb,time,text) to authenticated;
-- Existing clients remain supported, including retries of requests without a time.
create or replace function public.owner_request_extra_visit(p_tenant uuid,p_id uuid,p_customer uuid,p_date date,p_items jsonb,p_note text default '') returns uuid language sql security definer set search_path='' as $$
 select public.owner_request_extra_visit_at(p_tenant,p_id,p_customer,p_date,p_items,null,p_note);
$$;
create view public.owner_extra_visit_agenda with(security_invoker=true) as
 select e.tenant_id,e.id,e.customer_id,e.requested_on,e.requested_time,e.items,e.note,e.state,e.trip_id,c.name customer_name,c.address,t.name trip_name
 from public.extra_visit_requests e join public.customers c on c.tenant_id=e.tenant_id and c.id=e.customer_id left join public.inventory_trips t on t.tenant_id=e.tenant_id and t.id=e.trip_id
 where c.active and not c.pending_recovery and c.removed_at is null and (e.state='pending' or(e.state='assigned' and t.removed_at is null and t.status in ('planned','active') and not exists(select 1 from public.route_stops s where s.tenant_id=e.tenant_id and s.trip_id=e.trip_id and s.customer_id=e.customer_id and s.outcome in ('delivered','no_purchase'))));
revoke all on public.owner_extra_visit_agenda from public,anon,authenticated;
grant select on public.owner_extra_visit_agenda to authenticated;
do $$ declare definition text;needle text;replacement text;begin
 definition:=pg_get_functiondef('private.planning_push_eligible(uuid,uuid,date,timestamptz)'::regprocedure);
 needle:='and exists(select 1 from public.customer_schedules';
 if position(needle in definition)=0 or position('and not c.pending_recovery));' in definition)=0 then raise exception 'Contrato de elegibilidad inesperado';end if;
 definition:=replace(definition,needle,'and (exists(select 1 from public.customer_schedules');
 definition:=replace(definition,'and not c.pending_recovery));','and not c.pending_recovery) or exists(select 1 from public.owner_extra_visit_agenda e where e.tenant_id=t and e.requested_on=d)));');
 execute definition;
 definition:=pg_get_functiondef('public.push_claim_planning_notifications(integer,timestamptz)'::regprocedure);
 needle:='''customer_count'',(select count(*) from public.customer_schedules';
 replacement:='''extra_count'',(select count(*) from public.owner_extra_visit_agenda e where e.tenant_id=j.tenant_id and e.requested_on=j.target_date),''first_extra_time'',(select to_char(min(e.requested_time),''HH24:MI'') from public.owner_extra_visit_agenda e where e.tenant_id=j.tenant_id and e.requested_on=j.target_date),''customer_count'',(select count(distinct customer_id) from (select customer_id from public.owner_extra_visit_agenda e where e.tenant_id=j.tenant_id and e.requested_on=j.target_date union all select v.customer_id from public.customer_schedules';
 if position(needle in definition)=0 then raise exception 'Contrato de resumen inesperado';end if;
 definition:=replace(definition,needle,replacement);
 needle:='and not c.pending_recovery),';
 if position(needle in definition)=0 then raise exception 'Contrato de conteo inesperado';end if;
 definition:=replace(definition,needle,'and not c.pending_recovery) all_customers),');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
