begin;
create function public.admin_access_history()
returns table(id uuid,tenant_name text,user_email text,actor_email text,is_active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query select e.id,t.name,u.email::text,a.email::text,e.is_active,e.created_at
 from public.admin_member_events e
 join public.tenants t on t.id=e.tenant_id
 join auth.users u on u.id=e.user_id
 join auth.users a on a.id=e.actor_id
 order by e.created_at desc,e.id desc limit 100;
end $$;
revoke all on function public.admin_access_history() from public,anon;
grant execute on function public.admin_access_history() to authenticated;
commit;
