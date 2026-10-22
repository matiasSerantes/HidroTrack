begin;
-- Stage 1 exposes personal account + minimal chief names only. Legacy driver
-- contracts grant access on assignment without acceptance. Keep that branch
-- disabled until stage 2 audits ALL trip/commerce/promotion/position paths.
-- Owner/admin behavior and stored memberships remain unchanged.
create or replace function private.has_role(target uuid,allowed text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tenant_members m join public.licenses l on l.tenant_id=m.tenant_id
 where m.tenant_id=target and m.user_id=auth.uid() and m.active
 and m.role='owner' and m.role=any(allowed)
 and l.status='active' and (l.kind='permanent' or l.expires_at>now()));
$$;
notify pgrst,'reload schema';
commit;
