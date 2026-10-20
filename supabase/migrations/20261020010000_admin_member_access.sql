begin;
create table public.admin_member_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 user_id uuid not null,
 actor_id uuid not null references auth.users(id),
 was_active boolean not null,
 is_active boolean not null,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,user_id) references public.tenant_members(tenant_id,user_id),
 check(was_active <> is_active)
);
alter table public.admin_member_events enable row level security;
revoke all on public.admin_member_events from public,anon,authenticated;
grant select on public.admin_member_events to authenticated;
create policy admin_member_events_read on public.admin_member_events for select to authenticated using(private.is_admin());

create function public.admin_set_driver_access(p_tenant uuid,p_user uuid,p_active boolean)
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
  if (select count(*) from public.tenant_members where tenant_id=p_tenant and role='driver' and active)>=license.driver_limit then raise exception 'Se alcanzó el límite de choferes'; end if;
 end if;
 update public.tenant_members set active=p_active where tenant_id=p_tenant and user_id=p_user;
 insert into public.admin_member_events(tenant_id,user_id,actor_id,was_active,is_active) values(p_tenant,p_user,auth.uid(),membership.active,p_active);
 return p_active;
end $$;
revoke all on function public.admin_set_driver_access(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_set_driver_access(uuid,uuid,boolean) to authenticated;
commit;
