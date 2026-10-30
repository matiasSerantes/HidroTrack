begin;
-- Role discovery must remain available at AAL1 so the UI can show the challenge.
-- It reveals only whether the current authenticated user has the platform role.
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins where user_id=auth.uid());
$$;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins where user_id=auth.uid())
 and (not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.factor_type='totp' and f.status='verified')
      or coalesce(auth.jwt()->>'aal','aal1')='aal2');
$$;
-- Existing ACL on private.is_admin is retained for RLS policy evaluation.
create function public.admin_mfa_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_admin() then raise exception 'Solo superadministracion' using errcode='42501'; end if;
 return jsonb_build_object('enabled',exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.factor_type='totp' and f.status='verified'),'allowed',private.is_admin());
end $$;
revoke all on function public.is_platform_admin(),public.admin_mfa_state() from public,anon,authenticated;
grant execute on function public.is_platform_admin(),public.admin_mfa_state() to authenticated;
notify pgrst,'reload schema';
commit;
