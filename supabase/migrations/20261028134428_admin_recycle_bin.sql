begin;
create table private.recycle_bin (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 kind text not null check(kind in ('customer','trip')),entity_id uuid not null,
 label text not null,deleted_by uuid references auth.users(id),deleted_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 days',
 state text not null default 'deleted' check(state in ('deleted','restored','purged')),
 payload jsonb,restored_at timestamptz,restored_by uuid references auth.users(id),purged_at timestamptz
);
create unique index recycle_bin_current on private.recycle_bin(tenant_id,kind,entity_id) where state='deleted';
create index recycle_bin_expiry on private.recycle_bin(expires_at) where state='deleted';
revoke all on private.recycle_bin from public,anon,authenticated;
create function private.protect_removed_customer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.removed_at is not null and (new.active or new.removed_at is null) and not private.is_admin() then raise exception 'Solo superadministracion puede recuperar clientes eliminados' using errcode='42501'; end if;
 return new;
end $$;
create trigger protect_removed_customer before update on public.customers for each row execute function private.protect_removed_customer();
revoke all on function private.protect_removed_customer() from public,anon,authenticated;
-- Keep the existing recovery/closure guards behind the new atomic snapshot.
alter function public.owner_remove_customer(uuid,uuid) rename to remove_customer_guarded;
alter function public.remove_customer_guarded(uuid,uuid) set schema private;
alter function public.owner_remove_trip(uuid,uuid) rename to remove_trip_guarded;
alter function public.remove_trip_guarded(uuid,uuid) set schema private;
revoke all on function private.remove_customer_guarded(uuid,uuid),private.remove_trip_guarded(uuid,uuid) from public,anon,authenticated;

create function public.owner_remove_customer(p_tenant uuid,p_customer uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.customers;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede eliminar clientes' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into c from public.customers where tenant_id=p_tenant and id=p_customer for update;
 if not found then raise exception 'Cliente no encontrado'; end if;
 if c.removed_at is not null then return p_customer; end if;
 perform private.remove_customer_guarded(p_tenant,p_customer);
 insert into private.recycle_bin(tenant_id,kind,entity_id,label,deleted_by,payload)
 values(p_tenant,'customer',p_customer,c.name,auth.uid(),jsonb_build_object('row',to_jsonb(c)))
 on conflict(tenant_id,kind,entity_id) where state='deleted' do update set label=excluded.label,deleted_by=excluded.deleted_by,
 deleted_at=excluded.deleted_at,expires_at=excluded.expires_at,state='deleted',payload=excluded.payload,restored_at=null,restored_by=null,purged_at=null;
 return p_customer;
end $$;
create function public.owner_remove_trip(p_tenant uuid,p_trip uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.inventory_trips;snapshot jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede eliminar recorridos' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into t from public.inventory_trips where tenant_id=p_tenant and id=p_trip for update;
 if not found then raise exception 'Recorrido no encontrado'; end if;
 if t.removed_at is not null then return p_trip; end if;
 snapshot:=jsonb_build_object('row',to_jsonb(t),'active_stops',coalesce((select jsonb_agg(customer_id) from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and active),'[]'::jsonb));
 perform private.remove_trip_guarded(p_tenant,p_trip);
 insert into private.recycle_bin(tenant_id,kind,entity_id,label,deleted_by,payload)
 values(p_tenant,'trip',p_trip,t.name,auth.uid(),snapshot)
 on conflict(tenant_id,kind,entity_id) where state='deleted' do update set label=excluded.label,deleted_by=excluded.deleted_by,
 deleted_at=excluded.deleted_at,expires_at=excluded.expires_at,state='deleted',payload=excluded.payload,restored_at=null,restored_by=null,purged_at=null;
 return p_trip;
end $$;

create function public.admin_recycle_bin(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Pagina invalida'; end if;
 return jsonb_build_object('count',(select count(*) from private.recycle_bin where state='deleted'),
 'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.deleted_at desc,x.id) from
 (select r.id,r.kind,r.label,r.tenant_id,t.name company,r.deleted_at,r.expires_at,
 coalesce(p.full_name,'Usuario de la empresa') deleted_by,r.expires_at>now() recoverable
 from private.recycle_bin r join public.tenants t on t.id=r.tenant_id left join public.user_profiles p on p.user_id=r.deleted_by
 where r.state='deleted' order by r.deleted_at desc,r.id limit 50 offset p_offset) x),'[]'::jsonb));
end $$;

create function public.admin_restore_removed(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare item private.recycle_bin;target_tenant uuid;t public.inventory_trips;customer_row public.customers;member_active boolean;
begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501'; end if;
 select tenant_id into target_tenant from private.recycle_bin where id=p_id;
 if not found then raise exception 'Registro no encontrado'; end if;
 -- Same tenant-first lock order as deletion and stock operations.
 perform 1 from public.tenants where id=target_tenant for update;
 select * into item from private.recycle_bin where id=p_id for update;
 if item.state='restored' then return item.entity_id; end if;
 if item.state<>'deleted' or item.expires_at<=now() or item.payload is null then raise exception 'Vencio el plazo de recuperacion de 10 dias'; end if;
 if item.kind='customer' then
  select * into customer_row from public.customers where tenant_id=item.tenant_id and id=item.entity_id for update;
  if not found or customer_row.removed_at is null then raise exception 'La ficha cambio; actualiza antes de recuperar'; end if;
  update public.customers set active=coalesce((item.payload->'row'->>'active')::boolean,true),removed_at=null,removed_by=null where tenant_id=item.tenant_id and id=item.entity_id;
  -- Do not silently add a recovered customer to routes that may have changed.
 else
  select * into t from public.inventory_trips where tenant_id=item.tenant_id and id=item.entity_id for update;
  if not found or t.removed_at is null then raise exception 'El recorrido cambio; actualiza antes de recuperar'; end if;
  if item.payload->'row'->>'status'='planned' then
   if exists(select 1 from public.inventory_operations where tenant_id=item.tenant_id and trip_id=item.entity_id) then raise exception 'El recorrido tiene movimientos; no puede volver a planificado'; end if;
   select active into member_active from public.tenant_members where tenant_id=item.tenant_id and user_id=t.driver_id;
   if not coalesce(member_active,false) then raise exception 'Primero habilita al chofer en la empresa'; end if;
   update public.inventory_trips set status='planned',started_at=null,submitted_at=null,closed_at=null,removed_at=null,removed_by=null where tenant_id=item.tenant_id and id=item.entity_id;
   -- An assistant must accept again. Never restore an earlier acceptance.
   update public.trip_invitations set state='pending',answered_at=null,revoked_at=null,created_at=now() where tenant_id=item.tenant_id and trip_id=item.entity_id;
   insert into public.trip_invitation_events(tenant_id,trip_id,actor_id,action)
    select tenant_id,trip_id,auth.uid(),'pending' from public.trip_invitations where tenant_id=item.tenant_id and trip_id=item.entity_id;
  else
   update public.inventory_trips set removed_at=null,removed_by=null where tenant_id=item.tenant_id and id=item.entity_id;
  end if;
  update public.route_stops s set active=true,version=version+1,updated_at=now()
  where s.tenant_id=item.tenant_id and s.trip_id=item.entity_id
  and item.payload->'active_stops' ? s.customer_id::text
  and exists(select 1 from public.customers target where target.tenant_id=s.tenant_id and target.id=s.customer_id and target.active and not target.pending_recovery and target.removed_at is null);
 end if;
 update private.recycle_bin set state='restored',restored_at=now(),restored_by=auth.uid(),payload=null where id=p_id;
 return item.entity_id;
end $$;

-- Preserve earlier logical deletions, if any. A pre-feature trip can only return
-- as closed: its original planning state was not recorded before this feature.
insert into private.recycle_bin(tenant_id,kind,entity_id,label,deleted_by,deleted_at,expires_at,payload)
 select tenant_id,'customer',id,name,removed_by,removed_at,removed_at+interval '10 days',jsonb_build_object('row',to_jsonb(c)||jsonb_build_object('active',true)) from public.customers c where removed_at is not null;
insert into private.recycle_bin(tenant_id,kind,entity_id,label,deleted_by,deleted_at,expires_at,payload)
 select tenant_id,'trip',id,name,removed_by,removed_at,removed_at+interval '10 days',jsonb_build_object('row',to_jsonb(t),'active_stops','[]'::jsonb) from public.inventory_trips t where removed_at is not null;

revoke all on function public.owner_remove_customer(uuid,uuid),public.owner_remove_trip(uuid,uuid),public.admin_recycle_bin(integer),public.admin_restore_removed(uuid) from public,anon,authenticated;
grant execute on function public.owner_remove_customer(uuid,uuid),public.owner_remove_trip(uuid,uuid),public.admin_recycle_bin(integer),public.admin_restore_removed(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
