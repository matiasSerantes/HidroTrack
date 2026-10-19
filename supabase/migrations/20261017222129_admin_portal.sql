begin;
create function private.check_driver_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.driver_limit < (select count(*) from public.tenant_members where tenant_id=new.tenant_id and role='driver' and active) then
  raise exception 'El límite es menor que la cantidad de choferes activos';
 end if;
 return new;
end $$;
revoke all on function private.check_driver_capacity() from public,anon,authenticated;
create trigger license_capacity before update of driver_limit on public.licenses for each row execute function private.check_driver_capacity();
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$ select private.is_admin() $$;
revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;

create function public.admin_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',t.id,'name',t.name,'license',to_jsonb(l),'members',
 coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'active',m.active))
 from public.tenant_members m join auth.users u on u.id=m.user_id where m.tenant_id=t.id),'[]'::jsonb)
 ) order by t.created_at desc) from public.tenants t left join public.licenses l on l.tenant_id=t.id),'[]'::jsonb);
end $$;
revoke all on function public.admin_directory() from public,anon;
grant execute on function public.admin_directory() to authenticated;

-- Only the authenticated server function can bind a freshly created Auth user.
create function public.admin_provision(p_actor uuid,p_user uuid,p_name text,p_tenant uuid,p_role text,p_kind text,p_expires timestamptz,p_limit integer)
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
  select driver_limit into lim from public.licenses where tenant_id=target and status='active' and (kind='permanent' or expires_at>now()) for update;
  if not found then raise exception 'Licencia no vigente'; end if;
  select count(*) into used from public.tenant_members where tenant_id=target and role='driver' and active;
  if used>=lim then raise exception 'Límite de choferes alcanzado'; end if;
  insert into public.tenant_members(tenant_id,user_id,role) values(target,p_user,'driver');
 else raise exception 'Rol inválido'; end if;
 return target;
end $$;
revoke all on function public.admin_provision(uuid,uuid,text,uuid,text,text,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.admin_provision(uuid,uuid,text,uuid,text,text,timestamptz,integer) to service_role;
commit;
