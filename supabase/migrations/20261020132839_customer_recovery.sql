begin;
create table public.customer_deactivations (
 tenant_id uuid not null,
 id uuid not null,
 customer_id uuid not null,
 requested_by uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 1 and 400),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 decision_note text not null default '' check(length(decision_note)<=400),
 primary key(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 check((status='pending' and decided_by is null and decided_at is null) or
 (status<>'pending' and decided_by is not null and decided_at is not null))
);
create unique index customer_deactivation_pending on public.customer_deactivations(tenant_id,customer_id) where status='pending';
alter table public.customer_deactivations enable row level security;
create policy customer_deactivations_read on public.customer_deactivations for select to authenticated using(private.commerce_customer_access(tenant_id,customer_id));
revoke all on public.customer_deactivations from public,anon,authenticated;
grant select on public.customer_deactivations to authenticated;

alter table public.owner_notifications alter column sale_id drop not null;
alter table public.owner_notifications add column source_id uuid;
alter table public.owner_notifications add column customer_id uuid;
alter table public.owner_notifications add column trip_id uuid;
alter table public.owner_notifications add foreign key(tenant_id,customer_id) references public.customers(tenant_id,id);
alter table public.owner_notifications add foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id);
alter table public.owner_notifications drop constraint owner_notifications_kind_check;
alter table public.owner_notifications add constraint owner_notifications_kind_check check(kind in ('delivery','credit_request','recovery_pending','trip_closure'));
alter table public.owner_notifications add constraint owner_notification_source check(
 (kind in ('delivery','credit_request') and sale_id is not null) or
 (kind='recovery_pending' and source_id is not null and customer_id is not null and sale_id is null) or
 (kind='trip_closure' and source_id is not null and trip_id is not null and sale_id is null));
create unique index workflow_notification_once on public.owner_notifications(tenant_id,recipient_id,source_id,kind) where source_id is not null;

create function private.customer_recovery_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.customer_id is not null and exists(select 1 from public.customers where tenant_id=new.tenant_id and id=new.customer_id and pending_recovery) then
  if new.kind='dispenser_assign' or (new.kind='delivery' and exists(select 1 from jsonb_array_elements(new.items) i where (i->>'quantity')::numeric>0)) then
   raise exception 'Cliente en futura baja: solo recuperar artículos y cobrar pendientes';
  end if;
 end if;
 return new;
end $$;
create trigger customer_recovery_guard before insert on public.inventory_operations for each row execute function private.customer_recovery_guard();
revoke all on function private.customer_recovery_guard() from public,anon,authenticated;
create function private.customer_equipment_recovery_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ownership='company' and new.location='customer' and not new.retired
 and (tg_op='INSERT' or old.customer_id is distinct from new.customer_id or old.location<>'customer')
 and exists(select 1 from public.customers where tenant_id=new.tenant_id and id=new.customer_id and pending_recovery) then raise exception 'Cliente en futura baja: no asignar equipos'; end if;
 return new;
end $$;
create trigger customer_equipment_recovery_guard before insert or update on public.dispensers for each row execute function private.customer_equipment_recovery_guard();
revoke all on function private.customer_equipment_recovery_guard() from public,anon,authenticated;

create function public.customer_request_deactivation(p_tenant uuid,p_id uuid,p_customer uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.customer_deactivations;
begin
 if not private.commerce_customer_access(p_tenant,p_customer) then raise exception 'Cliente no asignado' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 400 then raise exception 'Indicá el motivo'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into previous from public.customer_deactivations where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.customer_id=p_customer and previous.requested_by=auth.uid() and previous.reason=p_reason then return p_id; end if;
  raise exception 'ID de solicitud ya utilizado';
 end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active and not pending_recovery) then raise exception 'Cliente inactivo o con baja pendiente'; end if;
 insert into public.customer_deactivations(tenant_id,id,customer_id,requested_by,reason) values(p_tenant,p_id,p_customer,auth.uid(),p_reason);
 update public.customers set pending_recovery=true where tenant_id=p_tenant and id=p_customer;
 insert into public.owner_notifications(tenant_id,recipient_id,kind,source_id,customer_id)
 select p_tenant,user_id,'recovery_pending',p_id,p_customer from public.tenant_members where tenant_id=p_tenant and role='owner' and active;
 return p_id;
end $$;

create function public.customer_review_deactivation(p_tenant uuid,p_id uuid,p_approve boolean,p_note text default '') returns text
language plpgsql security definer set search_path='' as $$
declare r public.customer_deactivations; decision text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede aprobar la baja' using errcode='42501'; end if;
 if p_approve is null or p_note is null or length(p_note)>400 then raise exception 'Decisión inválida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into r from public.customer_deactivations where tenant_id=p_tenant and id=p_id;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 decision:=case when p_approve then 'approved' else 'rejected' end;
 if r.status=decision and r.decided_by=auth.uid() and r.decision_note=p_note then return decision; end if;
 if r.status<>'pending' then raise exception 'Solicitud ya resuelta'; end if;
 if p_approve and (
 exists(select 1 from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and o.customer_id=r.customer_id group by m.product_id having sum(m.customer_held)>0)
 or exists(select 1 from public.dispensers where tenant_id=p_tenant and customer_id=r.customer_id and ownership='company' and not retired)
 or exists(select 1 from public.dispenser_assignments where tenant_id=p_tenant and customer_id=r.customer_id and status='active')) then raise exception 'Baja pendiente de recuperación de artículos'; end if;
 update public.customer_deactivations set status=decision,decided_by=auth.uid(),decided_at=now(),decision_note=p_note where tenant_id=p_tenant and id=p_id;
 update public.customers set pending_recovery=false,active=case when p_approve then false else active end where tenant_id=p_tenant and id=r.customer_id;
 if p_approve then
  update public.route_stops set active=false,version=version+1,updated_at=now() where tenant_id=p_tenant and customer_id=r.customer_id and outcome not in ('delivered','no_purchase');
 end if;
 return decision;
end $$;

-- Legacy archive cannot skip an outstanding recovery request.
create function private.customer_pending_archive_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=old.tenant_id for update;
 if old.pending_recovery and exists(select 1 from public.customer_deactivations where tenant_id=old.tenant_id and customer_id=old.id and status='pending') then
  if not new.active or not new.pending_recovery then raise exception 'Resolver la futura baja desde su solicitud'; end if;
 end if;
 return new;
end $$;
create trigger customer_pending_archive_guard before update on public.customers for each row execute function private.customer_pending_archive_guard();
revoke all on function private.customer_pending_archive_guard() from public,anon,authenticated;
create view public.pending_customer_recoveries with(security_invoker=true) as
select r.*,c.name,c.address,c.pending_recovery from public.customer_deactivations r join public.customers c on c.tenant_id=r.tenant_id and c.id=r.customer_id where r.status='pending';
-- The owner's existing customer policy protects this view; drivers use route_manifest.
revoke all on public.pending_customer_recoveries from public,anon,authenticated;
grant select on public.pending_customer_recoveries to authenticated;
revoke all on function public.customer_request_deactivation(uuid,uuid,uuid,text),public.customer_review_deactivation(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.customer_request_deactivation(uuid,uuid,uuid,text),public.customer_review_deactivation(uuid,uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
