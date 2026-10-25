begin;
-- Historical record of this person's own completed work. No current company
-- access, membership or licence is granted by this receipt-only projection.
create function private.driver_close_receipt(t uuid,r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'tenant_id',s.tenant_id,'company',s.snapshot->'company','driver',s.snapshot->'driver','trip',s.snapshot->'trip','closed_at',s.snapshot->'closed_at','closure_state','approved','declared_cash',s.snapshot->'declared_cash','initial_load',s.snapshot->'initial_load','stock',s.snapshot->'stock','declared_stock',s.snapshot->'declared_stock','note',s.snapshot->'note','decision_note',s.snapshot->'decision_note')
 from public.assistant_trip_close_snapshots s join public.trip_closures c on c.tenant_id=s.tenant_id and c.id=s.id join public.inventory_trips x on x.tenant_id=c.tenant_id and x.id=c.trip_id
 where s.tenant_id=t and s.id=r and c.status='approved' and x.status='closed' and s.snapshot->>'closure_state'='approved';
$$;
revoke all on function private.driver_close_receipt(uuid,uuid) from public,anon,authenticated;

create function public.assistant_close_receipts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Cuenta no verificada' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(v.receipt order by v.created_at desc,v.id) from (
  select s.id,s.created_at,private.driver_close_receipt(s.tenant_id,s.id) receipt from public.assistant_trip_close_snapshots s
  join public.trip_closures c on c.tenant_id=s.tenant_id and c.id=s.id join public.inventory_trips x on x.tenant_id=c.tenant_id and x.id=c.trip_id
  where s.actor_id=auth.uid() and c.status='approved' and x.status='closed' and s.snapshot->>'closure_state'='approved' order by s.created_at desc,s.id limit 10
 ) v),'[]'::jsonb);
end $$;

create function public.trip_close_receipt(p_tenant uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipt jsonb; actor uuid;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Cuenta no verificada' using errcode='42501'; end if;
 select s.snapshot,s.actor_id into receipt,actor from public.assistant_trip_close_snapshots s join public.trip_closures c on c.tenant_id=s.tenant_id and c.id=s.id join public.inventory_trips x on x.tenant_id=c.tenant_id and x.id=c.trip_id
 where s.tenant_id=p_tenant and s.id=p_id and c.status='approved' and x.status='closed' and s.snapshot->>'closure_state'='approved';
 if not found then raise exception 'Comprobante no disponible' using errcode='42501'; end if;
 if private.has_role(p_tenant,array['owner']) then return jsonb_build_object('role','owner','receipt',receipt||jsonb_build_object('tenant_id',p_tenant)); end if;
 if actor=auth.uid() then return jsonb_build_object('role','driver','receipt',private.driver_close_receipt(p_tenant,p_id)); end if;
 raise exception 'Comprobante no disponible' using errcode='42501';
end $$;
revoke all on function public.assistant_close_receipts(),public.trip_close_receipt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assistant_close_receipts(),public.trip_close_receipt(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
