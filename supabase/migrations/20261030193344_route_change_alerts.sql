begin;
create table private.route_change_config(id boolean primary key default true check(id),enabled boolean not null default false);
insert into private.route_change_config values(true,false);
create table private.route_change_preferences(user_id uuid primary key references auth.users(id),enabled boolean not null default false,updated_at timestamptz not null default now());
create table private.route_change_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,trip_id uuid not null,customer_id uuid not null,
 recipient_id uuid not null references auth.users(id),kind text not null check(kind in ('customer_updated','visit_window_updated','stop_added','stop_removed','stop_reordered')),
 position integer not null,created_at timestamptz not null default now(),read_at timestamptz,
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id) on delete cascade
);
create index route_change_recipient on private.route_change_events(recipient_id,tenant_id,trip_id,created_at desc);
create index route_change_expiry on private.route_change_events(created_at);
create table private.route_change_jobs(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references private.route_change_events(id) on delete cascade,
 subscription_id uuid not null references private.web_push_subscriptions(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','sent','cancelled')),attempts integer not null default 0,
 lease_until timestamptz,claim_token uuid,finished_at timestamptz,unique(event_id,subscription_id)
);
create index route_change_pending on private.route_change_jobs(event_id) where state='pending';
revoke all on private.route_change_config,private.route_change_preferences,private.route_change_events,private.route_change_jobs from public,anon,authenticated;

create function private.route_change_access(t uuid,r uuid,u uuid,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.inventory_trips x
 join public.trip_invitations i on i.tenant_id=x.tenant_id and i.trip_id=x.id and i.driver_id=x.driver_id and i.state='accepted'
 join public.tenant_members m on m.tenant_id=x.tenant_id and m.user_id=x.driver_id and m.role='driver' and m.active
 join public.licenses l on l.tenant_id=x.tenant_id and l.status='active' and (l.kind='permanent' or l.expires_at>at_time)
 join auth.users a on a.id=x.driver_id and a.deleted_at is null and a.email_confirmed_at is not null and (a.banned_until is null or a.banned_until<=at_time)
 where x.tenant_id=t and x.id=r and x.driver_id=u and x.status in ('planned','active') and x.removed_at is null);
$$;
create function private.queue_route_change(t uuid,r uuid,c uuid,k text,pos integer) returns void language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 if not private.has_role(t,array['owner']) then return;end if;
 select driver_id into recipient from public.inventory_trips where tenant_id=t and id=r;
 if recipient is null or recipient=auth.uid() or not private.route_change_access(t,r,recipient,now()) then return;end if;
 insert into private.route_change_events(tenant_id,trip_id,customer_id,recipient_id,kind,position) values(t,r,c,recipient,k,pos);
end $$;
create function private.capture_customer_route_change() returns trigger language plpgsql security definer set search_path='' as $$
declare t uuid;c uuid;k text;route record;
begin
 if tg_table_name='customers' then
  if row(new.name,new.address,new.phone,new.locality,new.latitude,new.longitude,new.pending_recovery) is not distinct from row(old.name,old.address,old.phone,old.locality,old.latitude,old.longitude,old.pending_recovery) then return null;end if;
  t:=new.tenant_id;c:=new.id;k:='customer_updated';
 else
  if tg_op='UPDATE' and row(new.start_time,new.end_time) is not distinct from row(old.start_time,old.end_time) then return null;end if;
  if tg_op='DELETE' then t:=old.tenant_id;c:=old.customer_id;else t:=new.tenant_id;c:=new.customer_id;end if;k:='visit_window_updated';
 end if;
 for route in select trip_id,position from public.route_stops where tenant_id=t and customer_id=c and active loop
  perform private.queue_route_change(t,route.trip_id,c,k,route.position);
 end loop;
 return null;
end $$;
create trigger customer_route_change after update on public.customers for each row execute function private.capture_customer_route_change();
create trigger visit_window_route_change after insert or update or delete on public.customer_visit_windows for each row execute function private.capture_customer_route_change();
create function private.capture_stop_route_change() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if tg_op='INSERT' then if not new.active then return null;end if;k:='stop_added';
 elsif old.active and not new.active then k:='stop_removed';
 elsif not old.active and new.active then k:='stop_added';
 elsif new.active and old.position<>new.position then k:='stop_reordered';else return null;end if;
 perform private.queue_route_change(new.tenant_id,new.trip_id,new.customer_id,k,new.position);return null;
end $$;
create trigger stop_route_change after insert or update on public.route_stops for each row execute function private.capture_stop_route_change();

create function public.assistant_route_changes(p_tenant uuid,p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.route_change_access(p_tenant,p_trip,auth.uid(),now()) then raise exception 'Reparto no accesible' using errcode='42501';end if;
 return jsonb_build_object('available',exists(select 1 from private.route_change_config c cross join private.web_push_config w where c.enabled and w.enabled),
 'push_enabled',coalesce((select enabled from private.route_change_preferences where user_id=auth.uid()),false),
 'unread',(select count(*) from private.route_change_events where tenant_id=p_tenant and trip_id=p_trip and recipient_id=auth.uid() and read_at is null and created_at>now()-interval '7 days'),
 'items',coalesce((select jsonb_agg(to_jsonb(v) order by (v.read_at is null) desc,v.created_at desc,v.id) from (
 select e.id,e.kind,e.position,e.created_at,e.read_at,case when c.active and c.removed_at is null then c.name else null end customer
 from private.route_change_events e left join public.customers c on c.tenant_id=e.tenant_id and c.id=e.customer_id
 where e.tenant_id=p_tenant and e.trip_id=p_trip and e.recipient_id=auth.uid() and e.created_at>now()-interval '7 days'
 order by (e.read_at is null) desc,e.created_at desc,e.id limit 50) v),'[]'::jsonb));
end $$;
create function public.assistant_read_route_changes(p_tenant uuid,p_trip uuid,p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.route_change_access(p_tenant,p_trip,auth.uid(),now()) then raise exception 'Reparto no accesible' using errcode='42501';end if;
 if p_ids is null or cardinality(p_ids)>50 then raise exception 'Cantidad invalida';end if;
 update private.route_change_events set read_at=coalesce(read_at,now()) where tenant_id=p_tenant and trip_id=p_trip and recipient_id=auth.uid() and id=any(p_ids);
end $$;
create function public.assistant_set_route_change_push(p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_enabled is null then raise exception 'Inicia sesion' using errcode='42501';end if;
 if p_enabled and (not exists(select 1 from private.route_change_config c cross join private.web_push_config w where c.enabled and w.enabled) or not exists(select 1 from private.web_push_subscriptions where user_id=auth.uid() and active)) then raise exception 'Activa primero los avisos en tu dispositivo';end if;
 insert into private.route_change_preferences values(auth.uid(),p_enabled,now()) on conflict(user_id) do update set enabled=excluded.enabled,updated_at=case when route_change_preferences.enabled is distinct from excluded.enabled then now() else route_change_preferences.updated_at end;
 return jsonb_build_object('enabled',p_enabled);
end $$;
create function private.route_change_push_eligible(eid uuid,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.route_change_events e join private.route_change_preferences p on p.user_id=e.recipient_id and p.enabled
 where e.id=eid and e.read_at is null and e.created_at>=p.updated_at and e.created_at>at_time-interval '24 hours'
 and exists(select 1 from private.route_change_config c cross join private.web_push_config w where c.enabled and w.enabled)
 and private.route_change_access(e.tenant_id,e.trip_id,e.recipient_id,at_time));
$$;
create function public.push_claim_route_changes(p_limit integer default 20,p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 delete from private.route_change_events where id in(select id from private.route_change_events where created_at<p_now-interval '7 days' order by created_at limit 500);
 if not exists(select 1 from private.route_change_config where enabled) then return '[]'::jsonb;end if;
 insert into private.route_change_jobs(event_id,subscription_id)
 select e.id,s.id from private.route_change_events e join private.web_push_subscriptions s on s.user_id=e.recipient_id and s.active
 where e.created_at>p_now-interval '24 hours' and private.route_change_push_eligible(e.id,p_now) on conflict do nothing;
 with candidates as (select j.id from private.route_change_jobs j join private.route_change_events e on e.id=j.event_id
 join private.web_push_subscriptions s on s.id=j.subscription_id and s.user_id=e.recipient_id and s.active
 where j.state='pending' and j.attempts<3 and (j.lease_until is null or j.lease_until<=p_now) and private.route_change_push_eligible(e.id,p_now)
 order by e.created_at,j.id for update of j skip locked limit greatest(1,least(p_limit,50))), claimed as (
 update private.route_change_jobs j set attempts=attempts+1,lease_until=p_now+interval '2 minutes',claim_token=gen_random_uuid() from candidates c where j.id=c.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'event_id',e.id,'claim_token',j.claim_token,'user_id',e.recipient_id,'tenant_id',e.tenant_id,'trip_id',e.trip_id,'kind',e.kind,
 'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key),'expires_at',least(e.created_at+interval '24 hours',p_now+interval '5 minutes'))),'[]'::jsonb)
 into result from claimed j join private.route_change_events e on e.id=j.event_id join private.web_push_subscriptions s on s.id=j.subscription_id;
 return result;
end $$;
create function public.push_route_change_valid(p_id uuid,p_claim uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.route_change_jobs j join private.route_change_events e on e.id=j.event_id join private.web_push_subscriptions s on s.id=j.subscription_id and s.user_id=e.recipient_id and s.active
 where j.id=p_id and j.claim_token=p_claim and j.state='pending' and j.lease_until>now() and private.route_change_push_eligible(e.id,now()));
$$;
create function public.push_finish_route_change(p_id uuid,p_claim uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
declare sub uuid;
begin
 if p_result not in ('sent','gone','cancelled','retry') then raise exception 'Resultado invalido';end if;
 update private.route_change_jobs set state=case when p_result='sent' then 'sent' when p_result in ('gone','cancelled') then 'cancelled' else 'pending' end,finished_at=case when p_result='retry' then null else now() end
 where id=p_id and claim_token=p_claim and state='pending' returning subscription_id into sub;
 if p_result='gone' and sub is not null then update private.web_push_subscriptions set active=false where id=sub;end if;
end $$;
revoke all on function private.route_change_access(uuid,uuid,uuid,timestamptz),private.queue_route_change(uuid,uuid,uuid,text,integer),private.capture_customer_route_change(),private.capture_stop_route_change(),private.route_change_push_eligible(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.assistant_route_changes(uuid,uuid),public.assistant_read_route_changes(uuid,uuid,uuid[]),public.assistant_set_route_change_push(boolean) from public,anon,authenticated;
grant execute on function public.assistant_route_changes(uuid,uuid),public.assistant_read_route_changes(uuid,uuid,uuid[]),public.assistant_set_route_change_push(boolean) to authenticated;
revoke all on function public.push_claim_route_changes(integer,timestamptz),public.push_route_change_valid(uuid,uuid),public.push_finish_route_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.push_claim_route_changes(integer,timestamptz),public.push_route_change_valid(uuid,uuid),public.push_finish_route_change(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
