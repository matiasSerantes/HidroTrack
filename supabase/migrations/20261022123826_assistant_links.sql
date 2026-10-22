-- Etapa 1: identidad Auth independiente, vinculos sin borrar historial y cupos.
begin;
alter table public.licenses add column driver_plan text not null default 'custom'
 check(driver_plan in ('custom','basic','intermediate','unlimited'));

create function private.normalize_driver_plan() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.driver_plan='basic' then new.driver_limit:=1;
 elsif new.driver_plan='intermediate' then new.driver_limit:=3;
 elsif new.driver_plan='unlimited' then new.driver_limit:=0;
 end if;
 if new.driver_plan<>'unlimited' and new.driver_limit < (select count(*) from public.tenant_members where tenant_id=new.tenant_id and role='driver' and active) then
  raise exception 'El limite es menor que los asistentes vinculados';
 end if;
 return new;
end $$;
revoke all on function private.normalize_driver_plan() from public,anon,authenticated;
drop trigger license_capacity on public.licenses;
-- Alphabetically before license_audit, so the audit captures normalized values.
create trigger license_00_plan before insert or update on public.licenses for each row execute function private.normalize_driver_plan();

-- Enforce capacity on every write path, not just the owner's RPC.
create function private.enforce_member_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.licenses;
begin
 if tg_op='UPDATE' and (new.tenant_id<>old.tenant_id or new.user_id<>old.user_id or new.role<>old.role) then
  raise exception 'La identidad y el rol del vinculo son inmutables';
 end if;
 if new.role<>'driver' or not new.active then return new; end if;
 select * into l from public.licenses where tenant_id=new.tenant_id for update;
 if l.tenant_id is null or l.status<>'active' or (l.kind='monthly' and l.expires_at<=now()) then raise exception 'Licencia no vigente'; end if;
 if l.driver_plan<>'unlimited' and
  (select count(*) from public.tenant_members where tenant_id=new.tenant_id and role='driver' and active and user_id<>new.user_id)>=l.driver_limit then
  raise exception 'Se alcanzo el limite de asistentes';
 end if;
 return new;
end $$;
revoke all on function private.enforce_member_capacity() from public,anon,authenticated;
create trigger member_capacity before insert or update on public.tenant_members for each row execute function private.enforce_member_capacity();

create table public.assistant_link_events (
 request_id uuid primary key,
 tenant_id uuid not null references public.tenants(id),
 user_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('link','unlink')),
 changed boolean not null,
 created_at timestamptz not null default now()
);
alter table public.assistant_link_events enable row level security;
revoke all on public.assistant_link_events from public,anon,authenticated;
grant select on public.assistant_link_events to authenticated;
create policy assistant_link_events_read on public.assistant_link_events for select to authenticated
 using(private.has_role(tenant_id,array['owner']) or private.is_admin());

create function public.owner_set_assistant_link(p_tenant uuid,p_share_id text,p_active boolean,p_request uuid)
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
 if not p_active and exists(select 1 from public.inventory_trips where tenant_id=p_tenant and driver_id=target and status<>'closed') then
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

create function public.owner_assistant_directory(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return jsonb_build_object('license',(select jsonb_build_object('plan',driver_plan,'limit',case when driver_plan='unlimited' then null else driver_limit end) from public.licenses where tenant_id=p_tenant),
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',coalesce(nullif(p.full_name,''),'Asistente'),'active',m.active) order by m.active desc,p.full_name,m.user_id)
 from public.tenant_members m left join public.user_profiles p on p.user_id=m.user_id where m.tenant_id=p_tenant and m.role='driver'),'[]'::jsonb));
end $$;

create function public.assistant_my_chiefs() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('company',t.name,'chief',coalesce(nullif(p.full_name,''),'Jefe de reparto')) order by t.name),'[]'::jsonb)
 from public.tenant_members m join public.tenants t on t.id=m.tenant_id
 join public.tenant_members o on o.tenant_id=m.tenant_id and o.role='owner' and o.active
 left join public.user_profiles p on p.user_id=o.user_id
 where m.user_id=auth.uid() and m.role='driver' and m.active;
$$;
revoke all on function public.owner_set_assistant_link(uuid,text,boolean,uuid),public.owner_assistant_directory(uuid),public.assistant_my_chiefs() from public,anon;
grant execute on function public.owner_set_assistant_link(uuid,text,boolean,uuid),public.owner_assistant_directory(uuid),public.assistant_my_chiefs() to authenticated;

-- Waiting assistants need only names through assistant_my_chiefs, not licenses.
drop policy license_read on public.licenses;
create policy license_read on public.licenses for select to authenticated using(private.is_admin() or exists(select 1 from public.tenant_members m where m.tenant_id=licenses.tenant_id and m.user_id=auth.uid() and m.role='owner' and m.active));
-- Preserve legacy administrative paths with the same unlimited semantics.
create or replace function public.admin_provision(p_actor uuid,p_user uuid,p_name text,p_tenant uuid,p_role text,p_kind text,p_expires timestamptz,p_limit integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; lim integer; used integer;
begin
 if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if p_role='owner' then
  insert into public.tenants(name) values(p_name) returning id into target;
  insert into public.tenant_members(tenant_id,user_id,role) values(target,p_user,'owner');
  insert into public.licenses(tenant_id,kind,status,expires_at,driver_limit) values(target,p_kind,'active',p_expires,p_limit);
 elsif p_role='driver' then
  target:=p_tenant;
  select case when driver_plan='unlimited' then null else driver_limit end into lim from public.licenses where tenant_id=target and status='active' and (kind='permanent' or expires_at>now()) for update;
  if not found then raise exception 'Licencia no vigente'; end if;
  select count(*) into used from public.tenant_members where tenant_id=target and role='driver' and active;
  if used>=lim then raise exception 'Límite de choferes alcanzado'; end if;
  insert into public.tenant_members(tenant_id,user_id,role) values(target,p_user,'driver');
 else raise exception 'Rol inválido'; end if;
 return target;
end $$;

create or replace function public.admin_set_driver_access(p_tenant uuid,p_user uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare membership public.tenant_members; license public.licenses;
begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_active is null then raise exception 'Estado inválido'; end if;
 -- Same lock as provisioning and license updates: concurrent activations share the quota.
 select * into license from public.licenses where tenant_id=p_tenant for update;
 select * into membership from public.tenant_members where tenant_id=p_tenant and user_id=p_user for update;
 if not found or membership.role <> 'driver' then raise exception 'Seleccioná un chofer de esta empresa'; end if;
 if membership.active=p_active then return p_active; end if;
 if p_active then
  if license.tenant_id is null or license.status<>'active' or (license.kind='monthly' and (license.expires_at is null or license.expires_at<=now())) then raise exception 'La empresa debe tener una licencia vigente'; end if;
  if license.driver_plan<>'unlimited' and (select count(*) from public.tenant_members where tenant_id=p_tenant and role='driver' and active)>=license.driver_limit then raise exception 'Se alcanzó el límite de choferes'; end if;
 end if;
 update public.tenant_members set active=p_active where tenant_id=p_tenant and user_id=p_user;
 insert into public.admin_member_events(tenant_id,user_id,actor_id,was_active,is_active) values(p_tenant,p_user,auth.uid(),membership.active,p_active);
 return p_active;
end $$;

commit;
