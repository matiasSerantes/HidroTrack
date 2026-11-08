begin;
create table public.customer_visit_cycles(
 tenant_id uuid not null,customer_id uuid not null,every_weeks integer not null default 1 check(every_weeks in (1,2)),anchor_date date,
 primary key(tenant_id,customer_id),foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 check((every_weeks=1 and anchor_date is null) or(every_weeks=2 and anchor_date is not null and isfinite(anchor_date) and anchor_date between date '1900-01-01' and date '2199-12-31'))
);
alter table public.customer_visit_cycles enable row level security;
create policy cycles_owner on public.customer_visit_cycles for select to authenticated using(private.has_role(tenant_id,array['owner']));
revoke all on public.customer_visit_cycles from public,anon,authenticated;
grant select on public.customer_visit_cycles to authenticated;
create function public.owner_set_customer_visit_cycle(p_tenant uuid,p_customer uuid,p_weeks integer,p_anchor date) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede configurar la frecuencia' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and removed_at is null and active and not pending_recovery) then raise exception 'Cliente no disponible';end if;
 if p_weeks is null or p_weeks not in (1,2) or (p_weeks=2 and (p_anchor is null or not isfinite(p_anchor) or p_anchor not between date '1900-01-01' and date '2199-12-31')) then raise exception 'Frecuencia o fecha invalida';end if;
 insert into public.customer_visit_cycles values(p_tenant,p_customer,p_weeks,case when p_weeks=2 then p_anchor else null end)
 on conflict(tenant_id,customer_id) do update set every_weeks=excluded.every_weeks,anchor_date=excluded.anchor_date;
 return jsonb_build_object('every_weeks',p_weeks,'anchor_date',case when p_weeks=2 then p_anchor else null end);
end $$;
revoke all on function public.owner_set_customer_visit_cycle(uuid,uuid,integer,date) from public,anon,authenticated;
grant execute on function public.owner_set_customer_visit_cycle(uuid,uuid,integer,date) to authenticated;
create view public.customer_schedule_cycles with(security_invoker=true) as
 select s.tenant_id,s.customer_id,s.weekday,coalesce(c.every_weeks,1) every_weeks,c.anchor_date from public.customer_schedules s left join public.customer_visit_cycles c using(tenant_id,customer_id);
revoke all on public.customer_schedule_cycles from public,anon,authenticated;
grant select on public.customer_schedule_cycles to authenticated;
create function private.customer_visit_cycle_due(t uuid,c uuid,d date) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.customer_visit_cycles v where v.tenant_id=t and v.customer_id=c and v.every_weeks=2 and
 (d<v.anchor_date or mod(((d-(extract(isodow from d)::integer-1))-(v.anchor_date-(extract(isodow from v.anchor_date)::integer-1)))/7,2)<>0));
$$;
revoke all on function private.customer_visit_cycle_due(uuid,uuid,date) from public,anon,authenticated;
do $$ declare definition text;begin
 definition:=pg_get_functiondef('private.planning_push_eligible(uuid,uuid,date,timestamptz)'::regprocedure);
 if position('s.weekday=extract(isodow from d)' in definition)=0 then raise exception 'Contrato de agenda inesperado';end if;
 execute replace(definition,'s.weekday=extract(isodow from d)','s.weekday=extract(isodow from d) and private.customer_visit_cycle_due(s.tenant_id,s.customer_id,d)');
 definition:=pg_get_functiondef('public.push_claim_planning_notifications(integer,timestamptz)'::regprocedure);
 if position('v.weekday=extract(isodow from j.target_date)' in definition)=0 then raise exception 'Contrato de recordatorio inesperado';end if;
 execute replace(definition,'v.weekday=extract(isodow from j.target_date)','v.weekday=extract(isodow from j.target_date) and private.customer_visit_cycle_due(v.tenant_id,v.customer_id,j.target_date)');
end $$;
notify pgrst,'reload schema';
commit;
