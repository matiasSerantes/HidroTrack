begin;
create table public.customer_visit_windows(
 tenant_id uuid not null,customer_id uuid not null,start_time time not null,end_time time not null,
 updated_at timestamptz not null default now(),primary key(tenant_id,customer_id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 check(start_time<end_time and end_time<time '24:00')
);
create table public.route_time_dismissals(
 tenant_id uuid not null,trip_id uuid not null,customer_id uuid not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(tenant_id,trip_id,customer_id),
 foreign key(tenant_id,trip_id,customer_id) references public.route_stops(tenant_id,trip_id,customer_id)
);
alter table public.customer_visit_windows enable row level security;
alter table public.route_time_dismissals enable row level security;
create policy visit_windows_owner on public.customer_visit_windows for select to authenticated using(private.has_role(tenant_id,array['owner']));
create policy time_dismissals_read on public.route_time_dismissals for select to authenticated using(private.has_role(tenant_id,array['owner']) or private.operational_trip_access(tenant_id,trip_id));
revoke all on public.customer_visit_windows,public.route_time_dismissals from public,anon,authenticated;
grant select on public.customer_visit_windows,public.route_time_dismissals to authenticated;

create function public.customer_set_visit_window(p_tenant uuid,p_customer uuid,p_start time,p_end time) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede cambiar horarios' using errcode='42501'; end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no habilitado'; end if;
 if p_start is null and p_end is null then delete from public.customer_visit_windows where tenant_id=p_tenant and customer_id=p_customer;return jsonb_build_object('saved',true);end if;
 if p_start is null or p_end is null or p_start>=p_end or p_end>=time '24:00' then raise exception 'Indica horario desde y hasta del mismo dia';end if;
 insert into public.customer_visit_windows values(p_tenant,p_customer,p_start,p_end,now()) on conflict(tenant_id,customer_id) do update set start_time=excluded.start_time,end_time=excluded.end_time,updated_at=now();
 return jsonb_build_object('saved',true);
end $$;
create function public.route_dismiss_time_reminder(p_tenant uuid,p_trip uuid,p_customer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not (private.has_role(p_tenant,array['owner']) or private.operational_trip_access(p_tenant,p_trip)) then raise exception 'Reparto no accesible' using errcode='42501';end if;
 if not exists(select 1 from public.route_stops s join public.inventory_trips t on t.tenant_id=s.tenant_id and t.id=s.trip_id where s.tenant_id=p_tenant and s.trip_id=p_trip and s.customer_id=p_customer and s.active and t.status='active' and s.outcome in ('pending','present')) then raise exception 'Parada no pendiente';end if;
 insert into public.route_time_dismissals values(p_tenant,p_trip,p_customer,auth.uid(),now()) on conflict do nothing;
 return jsonb_build_object('dismissed',true);
end $$;

create or replace function public.assistant_open_trip(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.operational_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 return jsonb_build_object('server_now',now(),
 'trip',(select jsonb_build_object('name',name,'date',service_date,'status',status) from public.inventory_trips where tenant_id=p_tenant and id=p_trip),
 'stops',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'locality',c.locality,'phone',c.phone,'latitude',c.latitude,'longitude',c.longitude,'position',r.position,'outcome',r.outcome,'followup',r.followup,'next_date',r.next_date,'pending_recovery',c.pending_recovery,
 'visit_start',to_char(w.start_time,'HH24:MI'),'visit_end',to_char(w.end_time,'HH24:MI'),'visit_starts_at',(t.service_date+w.start_time) at time zone 'America/Argentina/Buenos_Aires','reminder_dismissed',d.customer_id is not null)
 order by r.position,c.id) from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id
 join public.inventory_trips t on t.tenant_id=r.tenant_id and t.id=r.trip_id
 left join public.customer_visit_windows w on w.tenant_id=c.tenant_id and w.customer_id=c.id
 left join public.route_time_dismissals d on d.tenant_id=r.tenant_id and d.trip_id=r.trip_id and d.customer_id=r.customer_id
 where r.tenant_id=p_tenant and r.trip_id=p_trip and r.active and c.active),'[]'::jsonb),
 'stock',coalesce((select jsonb_agg(jsonb_build_object('product_id',s.product_id,'name',p.name,'unit',p.unit,'family',p.family,'returnable',p.returnable,'loaded',s.loaded,'ready',s.ready,'empties',s.empties) order by p.name,p.id)
 from (select m.product_id,coalesce(sum(m.truck_ready) filter(where o.kind='load'),0)::bigint loaded,sum(m.truck_ready)::bigint ready,sum(m.truck_empty)::bigint empties from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where o.tenant_id=p_tenant and o.trip_id=p_trip group by m.product_id) s join public.products p on p.tenant_id=p_tenant and p.id=s.product_id),'[]'::jsonb));
end $$;

create table private.web_push_config(id boolean primary key default true check(id),public_key text not null default '',enabled boolean not null default false);
insert into private.web_push_config(id) values(true);
create table private.web_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),endpoint text not null unique,
 p256dh text not null,auth_key text not null,active boolean not null default true,updated_at timestamptz not null default now()
);
create table private.web_push_jobs(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references private.web_push_subscriptions(id) on delete cascade,
 tenant_id uuid not null,trip_id uuid not null,customer_id uuid not null,user_id uuid not null references auth.users(id),window_start timestamptz not null,slot integer not null,
 state text not null default 'pending' check(state in ('pending','sent','cancelled')),attempts integer not null default 0,
 lease_until timestamptz,claim_token uuid,created_at timestamptz not null default now(),finished_at timestamptz,
 foreign key(tenant_id,trip_id,customer_id) references public.route_stops(tenant_id,trip_id,customer_id),
 unique(subscription_id,tenant_id,trip_id,customer_id,window_start,slot)
);
create index push_pending_jobs on private.web_push_jobs(state,lease_until) where state='pending';
revoke all on private.web_push_config,private.web_push_subscriptions,private.web_push_jobs from public,anon,authenticated;

create function public.push_get_settings() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesion' using errcode='42501';end if;
 return (select jsonb_build_object('enabled',enabled,'public_key',public_key) from private.web_push_config where id);
end $$;
create function public.push_subscribe(p_subscription jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_endpoint text:=p_subscription->>'endpoint';pkey text:=p_subscription->'keys'->>'p256dh';akey text:=p_subscription->'keys'->>'auth';existing private.web_push_subscriptions;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Cuenta no disponible' using errcode='42501';end if;
 if not exists(select 1 from private.web_push_config where id and enabled and public_key<>'') then raise exception 'Notificaciones aun no disponibles';end if;
 if v_endpoint is null or length(v_endpoint)>2048 or v_endpoint !~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/[^[:space:]]+$' or pkey is null or pkey !~ '^[A-Za-z0-9_-]{87,88}={0,2}$' or akey is null or akey !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception 'Suscripcion no valida';end if;
 perform 1 from auth.users where id=auth.uid() for update;
 select * into existing from private.web_push_subscriptions where web_push_subscriptions.endpoint=v_endpoint for update;
 if found and existing.user_id<>auth.uid() then raise exception 'El dispositivo esta vinculado a otra cuenta; desactiva sus avisos primero';end if;
 if not found and (select count(*) from private.web_push_subscriptions where user_id=auth.uid() and active)>=10 then raise exception 'Limite de dispositivos alcanzado';end if;
 insert into private.web_push_subscriptions(user_id,endpoint,p256dh,auth_key) values(auth.uid(),v_endpoint,pkey,akey) on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,active=true,updated_at=now();
 return jsonb_build_object('subscribed',true);
end $$;
create function public.push_unsubscribe(p_endpoint text) returns void language plpgsql security definer set search_path='' as $$
begin update private.web_push_subscriptions set active=false,updated_at=now() where user_id=auth.uid() and endpoint=p_endpoint;end $$;

create function private.push_visit_eligible(t uuid,r uuid,c uuid,u uuid,w timestamptz,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.inventory_trips x join public.route_stops s on s.tenant_id=x.tenant_id and s.trip_id=x.id
 join public.customers customer on customer.tenant_id=s.tenant_id and customer.id=s.customer_id
 join public.customer_visit_windows v on v.tenant_id=s.tenant_id and v.customer_id=s.customer_id
 join public.licenses l on l.tenant_id=x.tenant_id join public.tenant_members m on m.tenant_id=x.tenant_id and m.user_id=x.driver_id and m.active
 join auth.users a on a.id=x.driver_id and a.deleted_at is null and (a.banned_until is null or a.banned_until<=at_time)
 where x.tenant_id=t and x.id=r and x.driver_id=u and s.customer_id=c and x.status='active' and s.active and customer.active and s.outcome in ('pending','present')
 and at_time>=w-interval '1 hour' and at_time<((x.service_date+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') and (x.service_date+v.start_time) at time zone 'America/Argentina/Buenos_Aires'=w
 and l.status='active' and (l.kind='permanent' or l.expires_at>at_time)
 and (m.role='owner' or (m.role='driver' and exists(select 1 from public.trip_invitations i where i.tenant_id=t and i.trip_id=r and i.driver_id=u and i.state='accepted')))
 and not exists(select 1 from public.route_time_dismissals d where d.tenant_id=t and d.trip_id=r and d.customer_id=c));
$$;
create function public.push_claim_visit_notifications(p_limit integer default 20,p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from private.web_push_config where id and enabled) then return '[]'::jsonb;end if;
 insert into private.web_push_jobs(subscription_id,tenant_id,trip_id,customer_id,user_id,window_start,slot)
 select sub.id,t.tenant_id,t.id,s.customer_id,t.driver_id,(t.service_date+w.start_time) at time zone 'America/Argentina/Buenos_Aires',floor(extract(epoch from (p_now-(((t.service_date+w.start_time) at time zone 'America/Argentina/Buenos_Aires')-interval '1 hour')))/1800)::integer
 from public.inventory_trips t join public.route_stops s on s.tenant_id=t.tenant_id and s.trip_id=t.id
 join public.customer_visit_windows w on w.tenant_id=s.tenant_id and w.customer_id=s.customer_id
 join private.web_push_subscriptions sub on sub.user_id=t.driver_id and sub.active
 where t.service_date between (p_now at time zone 'America/Argentina/Buenos_Aires')::date and (p_now at time zone 'America/Argentina/Buenos_Aires')::date+1 and p_now>=((t.service_date+w.start_time) at time zone 'America/Argentina/Buenos_Aires')-interval '1 hour'
 and private.push_visit_eligible(t.tenant_id,t.id,s.customer_id,t.driver_id,(t.service_date+w.start_time) at time zone 'America/Argentina/Buenos_Aires',p_now)
 on conflict do nothing;
 with candidates as (select j.id from private.web_push_jobs j join private.web_push_subscriptions s on s.id=j.subscription_id and s.active
 where j.state='pending' and j.attempts<3 and (j.lease_until is null or j.lease_until<=p_now)
 and j.slot=floor(extract(epoch from(p_now-(j.window_start-interval '1 hour')))/1800)::integer
 and private.push_visit_eligible(j.tenant_id,j.trip_id,j.customer_id,j.user_id,j.window_start,p_now)
 order by j.created_at,j.id for update of j skip locked limit greatest(1,least(p_limit,50))),claimed as (
 update private.web_push_jobs j set attempts=attempts+1,lease_until=p_now+interval '2 minutes',claim_token=gen_random_uuid() from candidates c where j.id=c.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'claim_token',j.claim_token,'user_id',j.user_id,'trip_id',j.trip_id,'customer_id',j.customer_id,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key),
 'customer',c.name,'start',to_char(w.start_time,'HH24:MI'),'end',to_char(w.end_time,'HH24:MI'),'expires_at',j.window_start-interval '1 hour'+make_interval(mins=>(j.slot+1)*30))), '[]'::jsonb) into result
 from claimed j join private.web_push_subscriptions s on s.id=j.subscription_id join public.customers c on c.tenant_id=j.tenant_id and c.id=j.customer_id join public.customer_visit_windows w on w.tenant_id=c.tenant_id and w.customer_id=c.id;
 return result;
end $$;
create function public.push_job_still_valid(p_id uuid,p_claim uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.web_push_jobs j join private.web_push_subscriptions s on s.id=j.subscription_id and s.active where j.id=p_id and j.claim_token=p_claim and j.state='pending' and j.lease_until>now() and private.push_visit_eligible(j.tenant_id,j.trip_id,j.customer_id,j.user_id,j.window_start,now()) and j.slot=floor(extract(epoch from(now()-(j.window_start-interval '1 hour')))/1800)::integer);
$$;
create function public.push_finish_job(p_id uuid,p_claim uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result not in ('sent','gone','cancelled','retry') then raise exception 'Resultado invalido';end if;
 if p_result='gone' then update private.web_push_subscriptions set active=false where id=(select subscription_id from private.web_push_jobs where id=p_id and claim_token=p_claim);end if;
 update private.web_push_jobs set state=case when p_result='sent' then 'sent' when p_result in ('gone','cancelled') then 'cancelled' else 'pending' end,finished_at=case when p_result='retry' then null else now() end where id=p_id and claim_token=p_claim and state='pending';
end $$;
revoke all on function private.push_visit_eligible(uuid,uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.customer_set_visit_window(uuid,uuid,time,time),public.route_dismiss_time_reminder(uuid,uuid,uuid),public.push_get_settings(),public.push_subscribe(jsonb),public.push_unsubscribe(text) from public,anon,authenticated;
grant execute on function public.customer_set_visit_window(uuid,uuid,time,time),public.route_dismiss_time_reminder(uuid,uuid,uuid),public.push_get_settings(),public.push_subscribe(jsonb),public.push_unsubscribe(text) to authenticated;
revoke all on function public.push_claim_visit_notifications(integer,timestamptz),public.push_job_still_valid(uuid,uuid),public.push_finish_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.push_claim_visit_notifications(integer,timestamptz),public.push_job_still_valid(uuid,uuid),public.push_finish_job(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
