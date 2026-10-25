begin;
create table public.owner_signup_policy (
 id boolean primary key default true check(id),
 auto_trial boolean not null default false,
 trial_days integer not null default 30 check(trial_days between 1 and 90)
);
-- User decision: new verified owners get one basic 30-day trial.
insert into public.owner_signup_policy(id,auto_trial) values(true,true);
alter table public.owner_signup_policy enable row level security;
create policy owner_signup_policy_admin on public.owner_signup_policy for all to authenticated using(private.is_admin()) with check(private.is_admin());
revoke all on public.owner_signup_policy from public,anon,authenticated;
grant select,update on public.owner_signup_policy to authenticated;

create table public.owner_registrations (
 user_id uuid primary key references auth.users(id),
 tenant_id uuid not null unique references public.tenants(id),
 company_name text not null,
 activation_kind text not null check(activation_kind in ('trial','approval')),
 activated_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.owner_registrations enable row level security;
create policy owner_registrations_read on public.owner_registrations for select to authenticated using(user_id=auth.uid() or private.is_admin());
revoke all on public.owner_registrations from public,anon,authenticated;
grant select on public.owner_registrations to authenticated;

create function private.record_owner_activation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='active' then update public.owner_registrations set activated_at=coalesce(activated_at,now()) where tenant_id=new.tenant_id; end if;
 return new;
end $$;
revoke all on function private.record_owner_activation() from public,anon,authenticated;
create trigger owner_registration_activated after update of status on public.licenses for each row execute function private.record_owner_activation();

create function public.owner_signup_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare registration public.owner_registrations; membership public.tenant_members; policy public.owner_signup_policy;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Confirma tu correo antes de crear una empresa' using errcode='42501'; end if;
 select * into policy from public.owner_signup_policy where id;
 select * into registration from public.owner_registrations where user_id=auth.uid();
 if found then
  if not exists(select 1 from public.tenant_members where tenant_id=registration.tenant_id and user_id=auth.uid() and role='owner' and active) then return jsonb_build_object('state','blocked'); end if;
  return jsonb_build_object('state',case when registration.activated_at is null then 'waiting' else 'ready' end,'tenant_id',registration.tenant_id,'company',registration.company_name,'mode',registration.activation_kind);
 end if;
 select * into membership from public.tenant_members where user_id=auth.uid() and role='owner' order by active desc,tenant_id limit 1;
 if found then return jsonb_build_object('state',case when membership.active then 'ready' else 'blocked' end,'tenant_id',membership.tenant_id); end if;
 return jsonb_build_object('state','new','mode',case when policy.auto_trial then 'trial' else 'approval' end,'days',policy.trial_days,'driver_limit',1);
end $$;

create function public.owner_create_workspace(p_company text) returns uuid
language plpgsql security definer set search_path='' as $$
declare account auth.users; registration public.owner_registrations; target uuid; policy public.owner_signup_policy;
begin
 if p_company is null or length(trim(p_company)) not between 1 and 120 then raise exception 'Completa un nombre de empresa valido'; end if;
 select * into account from auth.users where id=auth.uid() for update;
 if not found or account.email_confirmed_at is null or account.deleted_at is not null or (account.banned_until is not null and account.banned_until>now()) then raise exception 'Confirma tu correo antes de crear una empresa' using errcode='42501'; end if;
 select * into registration from public.owner_registrations where user_id=auth.uid();
 if found then return registration.tenant_id; end if;
 select tenant_id into target from public.tenant_members where user_id=auth.uid() and role='owner' order by tenant_id limit 1;
 -- Administrative accounts and inactive memberships never receive a new trial.
 if found then return target; end if;
 select * into policy from public.owner_signup_policy where id for share;
 if not found then raise exception 'Politica de registro no disponible'; end if;
 target:=gen_random_uuid();
 insert into public.tenants(id,name) values(target,trim(p_company));
 insert into public.licenses(tenant_id,kind,status,expires_at,driver_limit,driver_plan)
 values(target,'monthly',case when policy.auto_trial then 'active' else 'suspended' end,now()+make_interval(days=>policy.trial_days),1,'basic');
 insert into public.tenant_members(tenant_id,user_id,role,active) values(target,auth.uid(),'owner',true);
 insert into public.owner_registrations(user_id,tenant_id,company_name,activation_kind,activated_at)
 values(auth.uid(),target,trim(p_company),case when policy.auto_trial then 'trial' else 'approval' end,case when policy.auto_trial then now() else null end);
 return target;
end $$;
revoke all on function public.owner_signup_status(),public.owner_create_workspace(text) from public,anon,authenticated;
grant execute on function public.owner_signup_status(),public.owner_create_workspace(text) to authenticated;
notify pgrst,'reload schema';
commit;
