begin;
alter table public.customer_visit_cycles drop constraint customer_visit_cycles_every_weeks_check;
alter table public.customer_visit_cycles add constraint customer_visit_cycles_every_weeks_check check(every_weeks in (1,2,3));
alter table public.customer_visit_cycles drop constraint customer_visit_cycles_check;
alter table public.customer_visit_cycles add constraint customer_visit_cycles_check check((every_weeks=1 and anchor_date is null) or(every_weeks in (2,3) and anchor_date is not null and isfinite(anchor_date) and anchor_date between date '1900-01-01' and date '2199-12-31'));
create or replace function public.owner_set_customer_visit_cycle(p_tenant uuid,p_customer uuid,p_weeks integer,p_anchor date) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede configurar la frecuencia' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and removed_at is null and active and not pending_recovery) then raise exception 'Cliente no disponible';end if;
 if p_weeks is null or p_weeks not in (1,2,3) or (p_weeks in (2,3) and (p_anchor is null or not isfinite(p_anchor) or p_anchor not between date '1900-01-01' and date '2199-12-31')) then raise exception 'Frecuencia o fecha invalida';end if;
 insert into public.customer_visit_cycles values(p_tenant,p_customer,p_weeks,case when p_weeks in (2,3) then p_anchor else null end)
 on conflict(tenant_id,customer_id) do update set every_weeks=excluded.every_weeks,anchor_date=excluded.anchor_date;
 return jsonb_build_object('every_weeks',p_weeks,'anchor_date',case when p_weeks in (2,3) then p_anchor else null end);
end $$;
create or replace function private.customer_visit_cycle_due(t uuid,c uuid,d date) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.customer_visit_cycles v where v.tenant_id=t and v.customer_id=c and v.every_weeks in (2,3) and
 (d<v.anchor_date or mod(((d-(extract(isodow from d)::integer-1))-(v.anchor_date-(extract(isodow from v.anchor_date)::integer-1)))/7,v.every_weeks)<>0));
$$;
revoke all on function private.customer_visit_cycle_due(uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.owner_set_customer_visit_cycle(uuid,uuid,integer,date) from public,anon,authenticated;
grant execute on function public.owner_set_customer_visit_cycle(uuid,uuid,integer,date) to authenticated;
notify pgrst,'reload schema';
commit;
