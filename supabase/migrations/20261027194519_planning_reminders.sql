begin;
create table private.planning_push_config(id boolean primary key default true check(id),enabled boolean not null default false);
insert into private.planning_push_config values(true,false);
create table private.planning_push_preferences(
 tenant_id uuid not null,user_id uuid not null,enabled boolean not null default false,updated_at timestamptz not null default now(),
 primary key(tenant_id,user_id),foreign key(tenant_id,user_id) references public.tenant_members(tenant_id,user_id)
);
create table private.planning_push_jobs(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references private.web_push_subscriptions(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id),user_id uuid not null references auth.users(id),target_date date not null,
 state text not null default 'pending' check(state in ('pending','sent','cancelled')),attempts integer not null default 0,
 lease_until timestamptz,claim_token uuid,created_at timestamptz not null default now(),finished_at timestamptz,
 unique(subscription_id,tenant_id,user_id,target_date)
);
create index planning_push_pending on private.planning_push_jobs(created_at) where state='pending';
revoke all on private.planning_push_config,private.planning_push_preferences,private.planning_push_jobs from public,anon,authenticated;

create function public.owner_planning_reminder_settings(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501';end if;
 return jsonb_build_object('available',exists(select 1 from private.planning_push_config p cross join private.web_push_config w where p.enabled and w.enabled),
 'enabled',coalesce((select enabled from private.planning_push_preferences where tenant_id=p_tenant and user_id=auth.uid()),false));
end $$;
create function public.owner_set_planning_reminder(p_tenant uuid,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501';end if;
 if p_enabled is null then raise exception 'Preferencia invalida';end if;
 if p_enabled and not exists(select 1 from private.planning_push_config p cross join private.web_push_config w where p.enabled and w.enabled) then raise exception 'Recordatorio no disponible';end if;
 insert into private.planning_push_preferences values(p_tenant,auth.uid(),p_enabled,now()) on conflict(tenant_id,user_id) do update set enabled=excluded.enabled,updated_at=excluded.updated_at;
 return jsonb_build_object('enabled',p_enabled);
end $$;
create function private.planning_push_eligible(t uuid,u uuid,d date,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.planning_push_preferences p
 join public.tenant_members m on m.tenant_id=p.tenant_id and m.user_id=p.user_id and m.active and m.role='owner'
 join public.licenses l on l.tenant_id=m.tenant_id and l.status='active' and (l.kind='permanent' or l.expires_at>at_time)
 join auth.users a on a.id=m.user_id and a.deleted_at is null and (a.banned_until is null or a.banned_until<=at_time)
 where p.tenant_id=t and p.user_id=u and p.enabled
 and exists(select 1 from private.planning_push_config c cross join private.web_push_config w where c.enabled and w.enabled)
 and (at_time at time zone 'America/Argentina/Buenos_Aires')::date=d-1
 and (at_time at time zone 'America/Argentina/Buenos_Aires')::time>='20:00'::time
 and (at_time at time zone 'America/Argentina/Buenos_Aires')::time<'21:00'::time
 and exists(select 1 from public.customer_schedules s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id
 where s.tenant_id=t and s.weekday=extract(isodow from d) and c.active and not c.pending_recovery));
$$;
create function public.push_claim_planning_notifications(p_limit integer default 20,p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path='' as $$
declare target date:=((p_now at time zone 'America/Argentina/Buenos_Aires')::date+1); result jsonb;
begin
 if not exists(select 1 from private.planning_push_config where enabled) then return '[]'::jsonb;end if;
 insert into private.planning_push_jobs(subscription_id,tenant_id,user_id,target_date)
 select s.id,p.tenant_id,p.user_id,target from private.planning_push_preferences p join private.web_push_subscriptions s on s.user_id=p.user_id and s.active
 where private.planning_push_eligible(p.tenant_id,p.user_id,target,p_now) on conflict do nothing;
 with candidates as (
 select j.id from private.planning_push_jobs j join private.web_push_subscriptions s on s.id=j.subscription_id and s.user_id=j.user_id and s.active
 where j.state='pending' and j.attempts<3 and (j.lease_until is null or j.lease_until<=p_now)
 and private.planning_push_eligible(j.tenant_id,j.user_id,j.target_date,p_now)
 order by j.created_at,j.id for update of j skip locked limit greatest(1,least(p_limit,50))
 ),claimed as (
 update private.planning_push_jobs j set attempts=attempts+1,lease_until=p_now+interval '2 minutes',claim_token=gen_random_uuid() from candidates c where j.id=c.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'claim_token',j.claim_token,'tenant_id',j.tenant_id,'user_id',j.user_id,'date',j.target_date,
 'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key),
 'customer_count',(select count(*) from public.customer_schedules v join public.customers c on c.tenant_id=v.tenant_id and c.id=v.customer_id where v.tenant_id=j.tenant_id and v.weekday=extract(isodow from j.target_date) and c.active and not c.pending_recovery),
 'has_route',exists(select 1 from public.inventory_trips t where t.tenant_id=j.tenant_id and t.service_date=j.target_date and t.status in ('planned','active','submitted')),
 'expires_at',((j.target_date-1)+time '21:00') at time zone 'America/Argentina/Buenos_Aires')),'[]'::jsonb) into result from claimed j join private.web_push_subscriptions s on s.id=j.subscription_id;
 return result;
end $$;
create function public.push_planning_job_still_valid(p_id uuid,p_claim uuid,p_now timestamptz default now()) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.planning_push_jobs j join private.web_push_subscriptions s on s.id=j.subscription_id and s.user_id=j.user_id and s.active where j.id=p_id and j.claim_token=p_claim and j.state='pending' and j.lease_until>p_now and private.planning_push_eligible(j.tenant_id,j.user_id,j.target_date,p_now));
$$;
create function public.push_finish_planning_job(p_id uuid,p_claim uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
declare sub uuid;
begin
 if p_result not in ('sent','gone','cancelled','retry') then raise exception 'Resultado invalido';end if;
 update private.planning_push_jobs set state=case when p_result='sent' then 'sent' when p_result in ('gone','cancelled') then 'cancelled' else 'pending' end,
 finished_at=case when p_result='retry' then null else now() end where id=p_id and claim_token=p_claim and state='pending' returning subscription_id into sub;
 if p_result='gone' and sub is not null then update private.web_push_subscriptions set active=false where id=sub;end if;
end $$;
revoke all on function private.planning_push_eligible(uuid,uuid,date,timestamptz) from public,anon,authenticated;
revoke all on function public.owner_planning_reminder_settings(uuid),public.owner_set_planning_reminder(uuid,boolean) from public,anon,authenticated;
grant execute on function public.owner_planning_reminder_settings(uuid),public.owner_set_planning_reminder(uuid,boolean) to authenticated;
revoke all on function public.push_claim_planning_notifications(integer,timestamptz),public.push_planning_job_still_valid(uuid,uuid,timestamptz),public.push_finish_planning_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.push_claim_planning_notifications(integer,timestamptz),public.push_planning_job_still_valid(uuid,uuid,timestamptz),public.push_finish_planning_job(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
