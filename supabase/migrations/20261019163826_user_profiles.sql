begin;
-- Auth conserva credenciales; aquí solo datos de presentación. Los roles siguen
-- en tenant_members/platform_admins y no se leen desde metadatos editables.
create table public.user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check(length(full_name)<=100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;

create function private.can_read_profile(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select target=(select auth.uid()) or exists(
  select 1 from public.tenant_members m where m.user_id=target and m.active
  and private.has_role(m.tenant_id,array['owner'])
 );
$$;
revoke all on function private.can_read_profile(uuid) from public,anon;
grant execute on function private.can_read_profile(uuid) to authenticated;
create policy profiles_read on public.user_profiles for select to authenticated using(private.can_read_profile(user_id));
create policy profiles_update_self on public.user_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.user_profiles from public,anon,authenticated;
grant select on public.user_profiles to authenticated;
grant update(full_name) on public.user_profiles to authenticated;

create function private.create_user_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_profiles(user_id,full_name)
 values(new.id,left(trim(coalesce(new.raw_user_meta_data->>'full_name','')),100));
 return new;
end $$;
revoke all on function private.create_user_profile() from public,anon,authenticated;
create trigger create_hidrotrack_profile after insert on auth.users for each row execute function private.create_user_profile();
create function private.profile_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
revoke all on function private.profile_updated_at() from public,anon,authenticated;
create trigger profile_updated_at before update on public.user_profiles for each row execute function private.profile_updated_at();
insert into public.user_profiles(user_id,full_name)
 select id,left(trim(coalesce(raw_user_meta_data->>'full_name','')),100) from auth.users;
commit;
