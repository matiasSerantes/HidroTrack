begin;
-- Roll out tracking only after the API guards and client are deployed.
create table private.email_verification_policy(id boolean primary key default true check(id),enabled boolean not null default false);
insert into private.email_verification_policy(id) values(true);
-- Preserve exact definitions for a pre-activation rollback, not a lossy rewrite.
create table private.email_api_guard_backup(signature text primary key,definition text not null);
revoke all on private.email_api_guard_backup from public,anon,authenticated;
create table private.email_verifications(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 created_at timestamptz not null,
 deadline timestamptz not null,
 proof_after timestamptz not null,
 verified_at timestamptz,
 check(deadline=created_at+interval '24 hours')
);
revoke all on private.email_verification_policy,private.email_verifications from public,anon,authenticated;

create function private.track_email_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.email is not null and new.email<>'' and coalesce(new.raw_app_meta_data->>'provider','email')='email' and exists(select 1 from private.email_verification_policy where id and enabled) then
   insert into private.email_verifications(user_id,email,created_at,deadline,proof_after)
   values(new.id,lower(new.email),new.created_at,new.created_at+interval '24 hours',new.created_at);
  end if;
 elsif new.email is distinct from old.email then
  -- Changing the address never renews the original deadline.
  update private.email_verifications set email=lower(coalesce(new.email,'')),verified_at=null,proof_after=clock_timestamp() where user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.track_email_verification() from public,anon,authenticated;
create trigger hidrotrack_email_verification after insert or update of email on auth.users for each row execute function private.track_email_verification();

create function private.email_access_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u left join private.email_verifications v on v.user_id=u.id
 where u.id=auth.uid() and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and (v.user_id is null or (lower(coalesce(u.email,''))=v.email and (v.verified_at is not null or now()<v.deadline))));
$$;
create function private.require_email_access() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not private.email_access_allowed() then raise exception 'Validá tu correo para continuar. El acceso provisional de 24 horas venció o la cuenta no está disponible.' using errcode='42501'; end if;
end $$;
revoke all on function private.email_access_allowed(),private.require_email_access() from public,anon,authenticated;
grant execute on function private.email_access_allowed() to authenticated;

-- This is intentionally available even when expired. Only Supabase's signed
-- authentication methods prove control of the mailbox; a password does not.
create function public.email_access_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare account auth.users; v private.email_verifications; claims jsonb:=auth.jwt(); proof boolean;
begin
 select * into account from auth.users where id=auth.uid() for update;
 if not found or account.deleted_at is not null or (account.banned_until is not null and account.banned_until>now()) then raise exception 'Cuenta no disponible' using errcode='42501'; end if;
 select * into v from private.email_verifications where user_id=account.id for update;
 if not found then return jsonb_build_object('state','verified','tracked',false); end if;
 proof:=lower(coalesce(claims->>'email',''))=v.email and lower(coalesce(account.email,''))=v.email and account.email_confirmed_at is not null and exists(
  select 1 from jsonb_array_elements(case when jsonb_typeof(claims->'amr')='array' then claims->'amr' else '[]'::jsonb end) method
  where method->>'method' in ('otp','magiclink','recovery','email/signup','email_change')
  and case when coalesce(method->>'timestamp','') ~ '^\d{1,12}$' then (method->>'timestamp')::bigint between floor(extract(epoch from v.proof_after))::bigint and floor(extract(epoch from clock_timestamp()))::bigint else false end);
 if v.verified_at is null and proof then
  update private.email_verifications set verified_at=clock_timestamp() where user_id=account.id returning * into v;
 end if;
 return jsonb_build_object('state',case when v.verified_at is not null then 'verified' when now()<v.deadline then 'provisional' else 'expired' end,'tracked',true,'email',v.email,'deadline',v.deadline,'server_now',clock_timestamp());
end $$;
revoke all on function public.email_access_status() from public,anon,authenticated;
grant execute on function public.email_access_status() to authenticated;

-- RPC owners bypass RLS. Gate every existing definer API before its original
-- body, preserving signatures, permissions, volatility, OIDs and business rules.
do $migration$
declare f record; body text; definition text;
begin
 for f in select p.*,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prosecdef and p.prorettype<>'trigger'::regtype and p.proname<>'email_access_status' and has_function_privilege('authenticated',p.oid,'EXECUTE')
 loop
  insert into private.email_api_guard_backup(signature,definition) values(f.oid::regprocedure::text,pg_get_functiondef(f.oid));
  if f.lanname='plpgsql' then body:='begin perform private.require_email_access(); '||rtrim(f.prosrc,E' \n\r\t;')||'; end';
  elsif f.lanname='sql' and not f.proretset and f.prorettype<>'void'::regtype then body:='begin perform private.require_email_access(); return ('||rtrim(f.prosrc,E' \n\r\t;')||'); end';
  else raise exception 'API needs an explicit verification guard: %',f.proname; end if;
  definition:=format('create or replace function public.%I(%s) returns %s language plpgsql %s security definer set search_path=%L as %L',f.proname,pg_get_function_arguments(f.oid),pg_get_function_result(f.oid),case f.provolatile when 'i' then 'stable' when 's' then 'stable' else 'volatile' end,'',body);
  execute definition;
 end loop;
 -- Direct table reads/writes must be blocked too, including existing sessions.
 for f in select tablename from pg_tables where schemaname='public' and rowsecurity loop
  execute format('create policy email_verification_access on public.%I as restrictive for all to authenticated using(private.email_access_allowed()) with check(private.email_access_allowed())',f.tablename);
 end loop;
end $migration$;
notify pgrst,'reload schema';
commit;
