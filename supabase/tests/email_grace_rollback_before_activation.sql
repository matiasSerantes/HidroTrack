-- Only for reverting the staged migration BEFORE any account uses the feature.
-- Does not run automatically and must never be used after activation.
begin;
do $$
declare f record;
begin
 if exists(select 1 from private.email_verification_policy where enabled) or exists(select 1 from private.email_verifications) then raise exception 'No rollback automatico tras activar o registrar usuarios. Conservar la proteccion y revisar un plan especifico.'; end if;
 for f in select definition from private.email_api_guard_backup loop execute f.definition; end loop;
 for f in select tablename from pg_policies where schemaname='public' and policyname='email_verification_access' loop execute format('drop policy email_verification_access on public.%I',f.tablename); end loop;
end $$;
drop trigger hidrotrack_email_verification on auth.users;
drop function public.email_access_status();
drop function private.track_email_verification();
drop function private.require_email_access();
drop function private.email_access_allowed();
drop table private.email_verifications,private.email_verification_policy,private.email_api_guard_backup;
notify pgrst,'reload schema';
commit;
