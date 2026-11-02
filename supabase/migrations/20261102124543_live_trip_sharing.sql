begin;
-- Reuse the existing last-position table. No route/history trail is added.
alter table public.driver_positions add column captured_at timestamptz not null default now(),add column sharing_session uuid,add column selected_customer uuid;
create table private.trip_sharing_sessions(
 tenant_id uuid not null,user_id uuid not null,trip_id uuid not null,session_id uuid not null,
 enabled boolean not null default true,updated_at timestamptz not null default now(),primary key(tenant_id,user_id),
 foreign key(tenant_id,user_id) references public.tenant_members(tenant_id,user_id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
revoke all on private.trip_sharing_sessions from public,anon,authenticated;
create function private.live_trip_driver(t uuid,r uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.route_change_access(t,r,u,now()) and exists(select 1 from public.inventory_trips where tenant_id=t and id=r and status='active');
$$;
create function private.live_position_visible(t uuid,r uuid,u uuid,s uuid,received timestamptz,captured timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select (u=auth.uid() or private.has_role(t,array['owner'])) and received>now()-interval '90 seconds' and captured>now()-interval '90 seconds'
 and private.live_trip_driver(t,r,u) and exists(select 1 from private.trip_sharing_sessions where tenant_id=t and user_id=u and trip_id=r and session_id=s and enabled);
$$;
drop policy driver_positions_read on public.driver_positions;
create policy driver_positions_read on public.driver_positions for select to authenticated using(private.live_position_visible(tenant_id,trip_id,user_id,sharing_session,updated_at,captured_at));
revoke all on function private.live_trip_driver(uuid,uuid,uuid),private.live_position_visible(uuid,uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
-- Required by the RLS expression; the helper checks the caller before revealing a boolean.
grant execute on function private.live_position_visible(uuid,uuid,uuid,uuid,timestamptz,timestamptz) to authenticated;

create function public.assistant_start_trip_sharing(p_tenant uuid,p_trip uuid,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.trip_sharing_sessions;
begin
 if p_session is null or not private.live_trip_driver(p_tenant,p_trip,auth.uid()) then raise exception 'Solo el chofer de un reparto activo aceptado puede compartir' using errcode='42501';end if;
 -- Serialize starts/stops/publications for this account within its company.
 perform 1 from public.tenant_members where tenant_id=p_tenant and user_id=auth.uid() for update;
 if not private.live_trip_driver(p_tenant,p_trip,auth.uid()) then raise exception 'Reparto no disponible' using errcode='42501';end if;
 select * into previous from private.trip_sharing_sessions where tenant_id=p_tenant and user_id=auth.uid() for update;
 if found and previous.session_id=p_session then
  if previous.trip_id=p_trip and previous.enabled then return jsonb_build_object('sharing',true);end if;
  raise exception 'Esta sesion de ubicacion ya termino';
 end if;
 insert into private.trip_sharing_sessions values(p_tenant,auth.uid(),p_trip,p_session,true,now())
 on conflict(tenant_id,user_id) do update set trip_id=excluded.trip_id,session_id=excluded.session_id,enabled=true,updated_at=now();
 delete from public.driver_positions where tenant_id=p_tenant and user_id=auth.uid();
 return jsonb_build_object('sharing',true);
end $$;
create function public.assistant_publish_trip_position(p_tenant uuid,p_trip uuid,p_session uuid,p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_captured timestamptz,p_customer uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare session private.trip_sharing_sessions;received timestamptz;
begin
 select * into session from private.trip_sharing_sessions where tenant_id=p_tenant and user_id=auth.uid() for update;
 if not found or not session.enabled or session.trip_id<>p_trip or session.session_id<>p_session or not private.live_trip_driver(p_tenant,p_trip,auth.uid()) then raise exception 'Ubicacion no autorizada o detenida' using errcode='42501';end if;
 if p_latitude is null or p_longitude is null or p_accuracy is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180) or not(p_accuracy between 0 and 100) or p_captured is null or not isfinite(p_captured) or p_captured<now()-interval '30 seconds' or p_captured>now()+interval '5 seconds' then raise exception 'GPS impreciso o muestra vencida';end if;
 if p_customer is not null and not exists(select 1 from public.route_stops s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id where s.tenant_id=p_tenant and s.trip_id=p_trip and s.customer_id=p_customer and s.active and c.active) then raise exception 'Parada no disponible';end if;
 insert into public.driver_positions(tenant_id,user_id,trip_id,latitude,longitude,accuracy,captured_at,sharing_session,selected_customer)
 values(p_tenant,auth.uid(),p_trip,p_latitude,p_longitude,p_accuracy,p_captured,p_session,p_customer)
 on conflict(tenant_id,user_id) do update set trip_id=excluded.trip_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,captured_at=excluded.captured_at,updated_at=now(),sharing_session=excluded.sharing_session,selected_customer=excluded.selected_customer
 where driver_positions.sharing_session is distinct from excluded.sharing_session or (driver_positions.captured_at<excluded.captured_at and driver_positions.updated_at<=now()-interval '10 seconds')
 returning updated_at into received;
 if received is not null then update private.trip_sharing_sessions set updated_at=now() where tenant_id=p_tenant and user_id=auth.uid();end if;
 return jsonb_build_object('updated',received is not null,'server_now',now());
end $$;
create function public.assistant_stop_trip_sharing(p_tenant uuid,p_trip uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesion' using errcode='42501';end if;
 update private.trip_sharing_sessions set enabled=false,updated_at=now() where tenant_id=p_tenant and user_id=auth.uid() and trip_id=p_trip and session_id=p_session;
 delete from public.driver_positions where tenant_id=p_tenant and user_id=auth.uid() and trip_id=p_trip and sharing_session=p_session;
end $$;
create function public.owner_live_trip_positions(p_tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe' using errcode='42501';end if;
 return jsonb_build_object('server_now',now(),'items',coalesce((select jsonb_agg(jsonb_build_object(
 'trip_id',t.id,'trip_name',t.name,'driver_id',t.driver_id,'driver_name',coalesce(nullif(p.full_name,''),'Asistente'),
 'total',(select count(*) from public.route_stops where tenant_id=t.tenant_id and trip_id=t.id and active),
 'attended',(select count(*) from public.route_stops where tenant_id=t.tenant_id and trip_id=t.id and active and outcome in ('delivered','no_purchase')),
 'latitude',g.latitude,'longitude',g.longitude,'accuracy',g.accuracy,'updated_at',g.updated_at,'customer',c.name
 ) order by t.name,t.id) from public.inventory_trips t left join public.user_profiles p on p.user_id=t.driver_id
 left join public.driver_positions g on g.tenant_id=t.tenant_id and g.trip_id=t.id and g.user_id=t.driver_id and private.live_position_visible(g.tenant_id,g.trip_id,g.user_id,g.sharing_session,g.updated_at,g.captured_at)
 left join public.customers c on c.tenant_id=t.tenant_id and c.id=g.selected_customer and c.active and c.removed_at is null and exists(select 1 from public.route_stops s where s.tenant_id=t.tenant_id and s.trip_id=t.id and s.customer_id=c.id and s.active)
 where t.tenant_id=p_tenant and private.live_trip_driver(t.tenant_id,t.id,t.driver_id)),'[]'::jsonb));
end $$;
create function private.purge_trip_positions() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.driver_positions g where updated_at<now()-interval '5 minutes' or not private.live_trip_driver(g.tenant_id,g.trip_id,g.user_id) or not exists(select 1 from private.trip_sharing_sessions s where s.tenant_id=g.tenant_id and s.user_id=g.user_id and s.trip_id=g.trip_id and s.session_id=g.sharing_session and s.enabled);
 update private.trip_sharing_sessions set enabled=false where enabled and (updated_at<now()-interval '5 minutes' or not private.live_trip_driver(tenant_id,trip_id,user_id));
end $$;
create function private.invalidate_trip_sharing() returns trigger language plpgsql security definer set search_path='' as $$
declare t uuid;r uuid;u uuid;
begin
 if tg_table_name='trip_invitations' then
  if old.state<>'accepted' or (new.state='accepted' and new.driver_id=old.driver_id) then return null;end if;
  t:=old.tenant_id;r:=old.trip_id;u:=old.driver_id;
 elsif tg_table_name='inventory_trips' then
  if old.status=new.status and old.driver_id=new.driver_id and old.removed_at is not distinct from new.removed_at then return null;end if;
  t:=old.tenant_id;r:=old.id;
 elsif tg_table_name='tenant_members' then
  if new.active and new.role=old.role then return null;end if;t:=old.tenant_id;u:=old.user_id;
 else
  if row(new.kind,new.status,new.expires_at) is not distinct from row(old.kind,old.status,old.expires_at) then return null;end if;t:=old.tenant_id;
 end if;
 update private.trip_sharing_sessions set enabled=false,updated_at=now() where tenant_id=t and (r is null or trip_id=r) and (u is null or user_id=u);
 delete from public.driver_positions where tenant_id=t and (r is null or trip_id=r) and (u is null or user_id=u);
 return null;
end $$;
create trigger sharing_invitation_revoked after update on public.trip_invitations for each row execute function private.invalidate_trip_sharing();
create trigger sharing_trip_finished after update on public.inventory_trips for each row execute function private.invalidate_trip_sharing();
create trigger sharing_member_disabled after update on public.tenant_members for each row execute function private.invalidate_trip_sharing();
create trigger sharing_license_changed after update on public.licenses for each row execute function private.invalidate_trip_sharing();
revoke all on function private.invalidate_trip_sharing() from public,anon,authenticated;
revoke all on function private.purge_trip_positions() from public,anon,authenticated;
revoke all on function public.assistant_start_trip_sharing(uuid,uuid,uuid),public.assistant_publish_trip_position(uuid,uuid,uuid,double precision,double precision,double precision,timestamptz,uuid),public.assistant_stop_trip_sharing(uuid,uuid,uuid),public.owner_live_trip_positions(uuid) from public,anon,authenticated;
grant execute on function public.assistant_start_trip_sharing(uuid,uuid,uuid),public.assistant_publish_trip_position(uuid,uuid,uuid,double precision,double precision,double precision,timestamptz,uuid),public.assistant_stop_trip_sharing(uuid,uuid,uuid),public.owner_live_trip_positions(uuid) to authenticated;
do $$ begin
 if to_regnamespace('cron') is not null then perform cron.schedule('hidrotrack-trip-position-expiry','* * * * *','select private.purge_trip_positions();');end if;
end $$;
notify pgrst,'reload schema';
commit;
