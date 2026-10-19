-- Fase 1. Aplicar en un proyecto Supabase nuevo. Altas administrativas solo vía servidor.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.tenants (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create table public.tenant_members (
 tenant_id uuid not null references public.tenants(id),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','driver')),
 active boolean not null default true,
 primary key (tenant_id,user_id)
);
create unique index one_owner_per_tenant on public.tenant_members(tenant_id) where role = 'owner';
create table public.platform_admins (
 user_id uuid primary key references auth.users(id)
);
create table public.licenses (
 tenant_id uuid primary key references public.tenants(id),
 kind text not null check (kind in ('permanent','monthly')),
 status text not null check (status in ('active','suspended')),
 expires_at timestamptz,
 driver_limit integer not null check (driver_limit >= 0),
 updated_at timestamptz not null default now(),
 check ((kind = 'permanent' and expires_at is null) or (kind = 'monthly' and expires_at is not null))
);
create table public.license_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 actor_id uuid references auth.users(id),
 old_value jsonb,
 new_value jsonb not null,
 created_at timestamptz not null default now()
);
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;
create function private.has_role(target uuid, allowed text[]) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.tenant_members m join public.licenses l on l.tenant_id=m.tenant_id
 where m.tenant_id=target and m.user_id=auth.uid() and m.active and m.role=any(allowed)
 and l.status='active' and (l.kind='permanent' or l.expires_at>now()));
$$;
revoke all on function private.is_admin() from public;
revoke all on function private.has_role(uuid,text[]) from public;
grant execute on function private.is_admin(), private.has_role(uuid,text[]) to authenticated;

create function private.audit_license() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.updated_at := now();
 insert into public.license_events(tenant_id,actor_id,old_value,new_value)
 values(new.tenant_id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
create trigger license_audit before insert or update on public.licenses for each row execute function private.audit_license();

create table public.customers (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 name text not null check (length(trim(name)) between 1 and 100),
 address text not null check (length(trim(address)) between 1 and 200),
 phone text not null default '',
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create table public.products (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 name text not null check (length(trim(name)) between 1 and 100),
 price numeric(14,2) not null check (price>=0),
 currency text not null default 'ARS' check (currency='ARS'),
 active boolean not null default true,
 unique(tenant_id,id)
);
create table public.customer_schedules (
 tenant_id uuid not null,
 customer_id uuid not null,
 weekday smallint not null check (weekday between 1 and 7),
 primary key(tenant_id,customer_id,weekday),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id)
);
create table public.customer_product_preferences (
 tenant_id uuid not null,
 customer_id uuid not null,
 product_id uuid not null,
 quantity integer not null check (quantity>0),
 primary key(tenant_id,customer_id,product_id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id)
);
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.licenses enable row level security;
alter table public.license_events enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.customer_schedules enable row level security;
alter table public.customer_product_preferences enable row level security;

create policy tenant_read on public.tenants for select to authenticated using(private.has_role(id,array['owner','driver']) or private.is_admin());
create policy members_read on public.tenant_members for select to authenticated using(user_id=auth.uid() or private.has_role(tenant_id,array['owner']));
create policy license_read on public.licenses for select to authenticated using(private.is_admin() or exists(select 1 from public.tenant_members m where m.tenant_id=licenses.tenant_id and m.user_id=auth.uid() and m.active));
create policy license_admin_insert on public.licenses for insert to authenticated with check(private.is_admin());
create policy license_admin_update on public.licenses for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy events_admin_read on public.license_events for select to authenticated using(private.is_admin());
-- Un superadmin no tiene acceso implícito a clientes/productos; choferes esperan asignaciones de fase 2.
create policy customers_owner on public.customers for all to authenticated using(private.has_role(tenant_id,array['owner'])) with check(private.has_role(tenant_id,array['owner']));
create policy products_owner on public.products for all to authenticated using(private.has_role(tenant_id,array['owner'])) with check(private.has_role(tenant_id,array['owner']));
create policy schedules_owner on public.customer_schedules for all to authenticated using(private.has_role(tenant_id,array['owner'])) with check(private.has_role(tenant_id,array['owner']));
create policy preferences_owner on public.customer_product_preferences for all to authenticated using(private.has_role(tenant_id,array['owner'])) with check(private.has_role(tenant_id,array['owner']));

revoke all on public.tenants,public.tenant_members,public.platform_admins,public.licenses,public.license_events,public.customers,public.products,public.customer_schedules,public.customer_product_preferences from anon,authenticated;
grant select on public.tenants,public.tenant_members,public.licenses,public.license_events to authenticated;
grant insert,update on public.licenses to authenticated;
grant select,insert,update,delete on public.customers,public.products,public.customer_schedules,public.customer_product_preferences to authenticated;
commit;
