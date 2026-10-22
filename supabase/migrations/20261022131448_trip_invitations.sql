begin;
create table public.trip_invitations (
 tenant_id uuid not null,
 trip_id uuid primary key,
 driver_id uuid not null,
 invited_by uuid not null references auth.users(id),
 state text not null default 'pending' check(state in ('pending','accepted','rejected','revoked')),
 created_at timestamptz not null default now(),
 answered_at timestamptz,
 revoked_at timestamptz,
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 foreign key(tenant_id,driver_id) references public.tenant_members(tenant_id,user_id)
);
create index trip_invitations_recipient on public.trip_invitations(driver_id,tenant_id);
create table public.trip_invitation_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid unique,
 tenant_id uuid not null,
 trip_id uuid not null references public.trip_invitations(trip_id),
 actor_id uuid references auth.users(id),
 action text not null check(action in ('pending','accepted','rejected','revoked')),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id)
);
alter table public.trip_invitations enable row level security;
alter table public.trip_invitation_events enable row level security;
revoke all on public.trip_invitations,public.trip_invitation_events from public,anon,authenticated;
-- Metadata lists are RPC-only for recipients. Raw audit is owner-only.
grant select on public.trip_invitation_events to authenticated;
create policy trip_invitation_events_owner on public.trip_invitation_events for select to authenticated using(private.has_role(tenant_id,array['owner']));

create function private.create_trip_invitation() returns trigger
language plpgsql security definer set search_path='' as $$
declare chief uuid;
begin
 select user_id into chief from public.tenant_members where tenant_id=new.tenant_id and role='owner' and active;
 if new.driver_id=chief or new.status='closed' then return new; end if;
 if chief is null or not exists(select 1 from public.tenant_members where tenant_id=new.tenant_id and user_id=new.driver_id and role='driver' and active) then raise exception 'Asistente no habilitado'; end if;
 insert into public.trip_invitations(tenant_id,trip_id,driver_id,invited_by) values(new.tenant_id,new.id,new.driver_id,chief);
 insert into public.trip_invitation_events(tenant_id,trip_id,actor_id,action) values(new.tenant_id,new.id,auth.uid(),'pending');
 return new;
end $$;
revoke all on function private.create_trip_invitation() from public,anon,authenticated;
create trigger trip_invitation_created after insert on public.inventory_trips for each row execute function private.create_trip_invitation();
-- Existing open assignments require a fresh acceptance too; never infer it.
insert into public.trip_invitations(tenant_id,trip_id,driver_id,invited_by)
 select t.tenant_id,t.id,t.driver_id,o.user_id from public.inventory_trips t
 join public.tenant_members d on d.tenant_id=t.tenant_id and d.user_id=t.driver_id and d.role='driver'
 join public.tenant_members o on o.tenant_id=t.tenant_id and o.role='owner' and o.active
 where t.status<>'closed';
insert into public.trip_invitation_events(tenant_id,trip_id,action) select tenant_id,trip_id,'pending' from public.trip_invitations;

create function private.accepted_trip_access(t uuid,r uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trip_invitations i
 join public.inventory_trips x on x.tenant_id=i.tenant_id and x.id=i.trip_id and x.driver_id=i.driver_id
 join public.tenant_members m on m.tenant_id=i.tenant_id and m.user_id=i.driver_id and m.role='driver' and m.active
 join public.licenses l on l.tenant_id=i.tenant_id
 where i.tenant_id=t and i.trip_id=r and i.driver_id=auth.uid() and i.state='accepted'
 and x.status<>'closed' and l.status='active' and (l.kind='permanent' or l.expires_at>now()));
$$;
revoke all on function private.accepted_trip_access(uuid,uuid) from public,anon,authenticated;

create function public.assistant_trip_invitations() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',i.tenant_id,'trip_id',i.trip_id,'name',t.name,'date',t.service_date,'status',t.status,'state',i.state,'company',c.name,'chief',coalesce(nullif(p.full_name,''),'Jefe de reparto')) order by t.service_date,i.created_at),'[]'::jsonb)
 from public.trip_invitations i join public.inventory_trips t on t.tenant_id=i.tenant_id and t.id=i.trip_id and t.driver_id=i.driver_id
 join public.tenants c on c.id=i.tenant_id left join public.user_profiles p on p.user_id=i.invited_by
 join public.tenant_members m on m.tenant_id=i.tenant_id and m.user_id=i.driver_id and m.role='driver' and m.active
 join public.licenses l on l.tenant_id=i.tenant_id
 where i.driver_id=auth.uid() and t.status<>'closed' and l.status='active' and (l.kind='permanent' or l.expires_at>now());
$$;

create function public.owner_trip_invitations(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('trip_id',i.trip_id,'name',t.name,'date',t.service_date,'status',t.status,'state',i.state,'driver',coalesce(nullif(p.full_name,''),'Asistente'),'answered_at',i.answered_at) order by t.service_date,i.created_at)
 from public.trip_invitations i join public.inventory_trips t on t.tenant_id=i.tenant_id and t.id=i.trip_id
 left join public.user_profiles p on p.user_id=i.driver_id where i.tenant_id=p_tenant and t.status<>'closed'),'[]'::jsonb);
end $$;

create function public.assistant_answer_trip_invitation(p_tenant uuid,p_trip uuid,p_accept boolean,p_request uuid) returns text
language plpgsql security definer set search_path='' as $$
declare i public.trip_invitations; e public.trip_invitation_events; desired text;
begin
 if auth.uid() is null or p_accept is null or p_request is null then raise exception 'Solicitud invalida' using errcode='42501'; end if;
 desired:=case when p_accept then 'accepted' else 'rejected' end;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform 1 from public.tenants where id=p_tenant for update;
 select * into i from public.trip_invitations where tenant_id=p_tenant and trip_id=p_trip for update;
 if not found or i.driver_id<>auth.uid() or not exists(
 select 1 from public.inventory_trips t join public.tenant_members m on m.tenant_id=t.tenant_id and m.user_id=t.driver_id
 join public.licenses l on l.tenant_id=t.tenant_id where t.tenant_id=p_tenant and t.id=p_trip and t.driver_id=i.driver_id and t.status<>'closed'
 and m.role='driver' and m.active and l.status='active' and (l.kind='permanent' or l.expires_at>now())) then raise exception 'Invitacion no disponible' using errcode='42501'; end if;
 select * into e from public.trip_invitation_events where request_id=p_request;
 if found then
  if e.tenant_id<>p_tenant or e.trip_id<>p_trip or e.actor_id<>auth.uid() or e.action<>desired then raise exception 'Solicitud reutilizada con otros datos'; end if;
  return i.state; -- Never report accepted after a later revocation.
 end if;
 if i.state<>'pending' then raise exception 'La invitacion ya fue respondida o revocada'; end if;
 update public.trip_invitations set state=desired,answered_at=now() where trip_id=p_trip;
 insert into public.trip_invitation_events(request_id,tenant_id,trip_id,actor_id,action) values(p_request,p_tenant,p_trip,auth.uid(),desired);
 return desired;
end $$;

create function public.owner_revoke_trip_invitation(p_tenant uuid,p_trip uuid,p_request uuid) returns text
language plpgsql security definer set search_path='' as $$
declare i public.trip_invitations; e public.trip_invitation_events;
begin
 if not private.has_role(p_tenant,array['owner']) or p_request is null then raise exception 'Acceso denegado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 select * into i from public.trip_invitations where tenant_id=p_tenant and trip_id=p_trip for update;
 if not found then raise exception 'Invitacion no disponible'; end if;
 select * into e from public.trip_invitation_events where request_id=p_request;
 if found then
  if e.tenant_id<>p_tenant or e.trip_id<>p_trip or e.actor_id<>auth.uid() or e.action<>'revoked' then raise exception 'Solicitud reutilizada con otros datos'; end if;
  return i.state;
 end if;
 if i.state='revoked' then return i.state; end if;
 update public.trip_invitations set state='revoked',revoked_at=now() where trip_id=p_trip;
 -- Preserve the last recorded position. Revocation changes access, not history.
 insert into public.trip_invitation_events(request_id,tenant_id,trip_id,actor_id,action) values(p_request,p_tenant,p_trip,auth.uid(),'revoked');
 return 'revoked';
end $$;

-- Dedicated read contract. Does not reopen any legacy driver write permission.
create function public.assistant_open_trip(p_tenant uuid,p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 return jsonb_build_object('trip',(select jsonb_build_object('name',name,'date',service_date,'status',status) from public.inventory_trips where tenant_id=p_tenant and id=p_trip),
 'stops',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'phone',c.phone,'latitude',c.latitude,'longitude',c.longitude,'position',r.position,'outcome',r.outcome,'pending_recovery',c.pending_recovery) order by r.position,c.id)
 from public.route_stops r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id
 where r.tenant_id=p_tenant and r.trip_id=p_trip and r.active and c.active),'[]'::jsonb));
end $$;

create function private.invitation_load_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='load' and exists(select 1 from public.inventory_trips t join public.tenant_members m on m.tenant_id=t.tenant_id and m.user_id=t.driver_id where t.tenant_id=new.tenant_id and t.id=new.trip_id and m.role='driver')
 and not exists(select 1 from public.trip_invitations i join public.inventory_trips t on t.tenant_id=i.tenant_id and t.id=i.trip_id and t.driver_id=i.driver_id where i.tenant_id=new.tenant_id and i.trip_id=new.trip_id and i.state='accepted') then
  raise exception 'El asistente debe aceptar el reparto antes de cargar';
 end if;
 return new;
end $$;
revoke all on function private.invitation_load_guard() from public,anon,authenticated;
create trigger invitation_load_guard before insert on public.inventory_operations for each row execute function private.invitation_load_guard();

revoke all on function public.assistant_trip_invitations(),public.owner_trip_invitations(uuid),public.assistant_answer_trip_invitation(uuid,uuid,boolean,uuid),public.owner_revoke_trip_invitation(uuid,uuid,uuid),public.assistant_open_trip(uuid,uuid) from public,anon;
grant execute on function public.assistant_trip_invitations(),public.owner_trip_invitations(uuid),public.assistant_answer_trip_invitation(uuid,uuid,boolean,uuid),public.owner_revoke_trip_invitation(uuid,uuid,uuid),public.assistant_open_trip(uuid,uuid) to authenticated;
-- A withdrawn, unloaded invitation must not trap a member in the team.
create or replace function public.owner_set_assistant_link(p_tenant uuid,p_share_id text,p_active boolean,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; m public.tenant_members; e public.assistant_link_events; changed boolean;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_active is null or p_request is null or p_share_id is null or p_share_id !~* '^HT-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'ID de asistente invalido'; end if;
 target:=substring(p_share_id from 4)::uuid;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into e from public.assistant_link_events where request_id=p_request;
 if found then
  if e.tenant_id<>p_tenant or e.user_id<>target or e.actor_id<>auth.uid() or e.action<>(case when p_active then 'link' else 'unlink' end) then raise exception 'Solicitud reutilizada con otros datos'; end if;
  return target;
 end if;
 -- Same tenant lock as trip creation: unlink cannot race a new assignment.
 perform 1 from public.tenants where id=p_tenant for update;
 perform 1 from public.licenses where tenant_id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Licencia no vigente' using errcode='42501'; end if;
 select * into m from public.tenant_members where tenant_id=p_tenant and user_id=target for update;
 if m.role='owner' or target=auth.uid() then raise exception 'Selecciona una cuenta de asistente'; end if;
 if p_active and not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now())) then
  raise exception 'El ID no corresponde a una cuenta verificada disponible';
 end if;
 if not p_active and m.user_id is null then raise exception 'Asistente no vinculado'; end if;
 if not p_active and exists(select 1 from public.inventory_trips where tenant_id=p_tenant and driver_id=target and status<>'closed' and not(status='planned' and exists(select 1 from public.trip_invitations i where i.tenant_id=p_tenant and i.trip_id=inventory_trips.id and i.state in ('rejected','revoked')))) then
  raise exception 'Cerra los repartos pendientes antes de quitar al asistente';
 end if;
 changed:=m.user_id is null or m.active<>p_active;
 if changed then
  insert into public.tenant_members(tenant_id,user_id,role,active) values(p_tenant,target,'driver',p_active)
  on conflict(tenant_id,user_id) do update set active=excluded.active;
 end if;
 insert into public.assistant_link_events(request_id,tenant_id,user_id,actor_id,action,changed)
 values(p_request,p_tenant,target,auth.uid(),case when p_active then 'link' else 'unlink' end,changed);
 return target;
end $$;


notify pgrst,'reload schema';
commit;
