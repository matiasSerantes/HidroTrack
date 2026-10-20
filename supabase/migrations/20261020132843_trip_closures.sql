begin;
create table public.trip_closures (
 tenant_id uuid not null,
 id uuid not null,
 trip_id uuid not null,
 actor_id uuid not null references auth.users(id),
 expected_cash numeric(14,2) not null,
 expected_transfer numeric(14,2) not null,
 declared_cash numeric(14,2) not null check(declared_cash>=0),
 declared_transfer numeric(14,2) not null check(declared_transfer>=0),
 expected_stock jsonb not null,
 declared_stock jsonb not null,
 note text not null check(length(note)<=400),
 status text not null default 'submitted' check(status in ('submitted','observed','approved')),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 decision_note text not null default '' check(length(decision_note)<=400),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 foreign key(tenant_id,trip_id) references public.inventory_trips(tenant_id,id),
 check((status='submitted' and decided_by is null and decided_at is null) or (status<>'submitted' and decided_by is not null and decided_at is not null))
);
create unique index trip_closure_one_pending on public.trip_closures(tenant_id,trip_id) where status='submitted';
create unique index trip_closure_one_approved on public.trip_closures(tenant_id,trip_id) where status='approved';
alter table public.trip_closures enable row level security;
create policy trip_closures_read on public.trip_closures for select to authenticated using(private.inventory_trip_access(tenant_id,trip_id));
revoke all on public.trip_closures from public,anon,authenticated;
grant select on public.trip_closures to authenticated;

create function private.trip_expected_stock(t uuid,r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('product_id',s.product_id,'ready',s.ready,'empties',s.empties) order by s.product_id),'[]'::jsonb)
from (select m.product_id,sum(m.truck_ready) ready,sum(m.truck_empty) empties from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=t and o.trip_id=r group by m.product_id having sum(m.truck_ready)<>0 or sum(m.truck_empty)<>0) s;
$$;
revoke all on function private.trip_expected_stock(uuid,uuid) from public,anon,authenticated;
create function private.trip_normalize_stock(stock jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb; seen uuid[]:='{}'; product uuid; ready numeric; empties numeric; result jsonb:='[]';
begin
 if stock is null or jsonb_typeof(stock)<>'array' or jsonb_array_length(stock)>200 then raise exception 'Conteo de stock inválido'; end if;
 for item in select value from jsonb_array_elements(stock) loop
  product:=(item->>'product_id')::uuid; ready:=(item->>'ready')::numeric; empties:=(item->>'empties')::numeric;
  if product is null or product=any(seen) or ready is null or empties is null or ready not between 0 and 100000 or empties not between 0 and 100000 or ready<>trunc(ready) or empties<>trunc(empties) then raise exception 'Conteo de stock inválido'; end if;
  seen:=array_append(seen,product);
  if ready+empties>0 then result:=result||jsonb_build_array(jsonb_build_object('product_id',product,'ready',ready,'empties',empties)); end if;
 end loop;
 return (select coalesce(jsonb_agg(value order by value->>'product_id'),'[]'::jsonb) from jsonb_array_elements(result));
end $$;
revoke all on function private.trip_normalize_stock(jsonb) from public,anon,authenticated;

create function public.trip_submit_close(p_tenant uuid,p_id uuid,p_trip uuid,p_cash numeric,p_transfer numeric,p_stock jsonb,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.trip_closures; counted jsonb; expected jsonb; cash numeric; transfer numeric;
begin
 if not private.inventory_trip_access(p_tenant,p_trip) then raise exception 'Reparto no asignado' using errcode='42501'; end if;
 if p_cash is null or p_transfer is null or p_cash not between 0 and 999999999999.99 or p_transfer not between 0 and 999999999999.99 or p_cash<>round(p_cash,2) or p_transfer<>round(p_transfer,2) or p_note is null or length(p_note)>400 then raise exception 'Rendición inválida'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 counted:=private.trip_normalize_stock(p_stock);
 select * into previous from public.trip_closures where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.declared_cash=p_cash and previous.declared_transfer=p_transfer and previous.declared_stock=counted and previous.note=p_note then return p_id; end if;
  raise exception 'ID de rendición ya utilizado';
 end if;
 if exists(select 1 from jsonb_array_elements(counted) i where not exists(select 1 from public.products where tenant_id=p_tenant and id=(i->>'product_id')::uuid)) then raise exception 'Artículo ajeno en rendición'; end if;
 expected:=private.trip_expected_stock(p_tenant,p_trip);
 select coalesce(sum(amount) filter(where method='cash'),0),coalesce(sum(amount) filter(where method='transfer'),0) into cash,transfer from public.payments where tenant_id=p_tenant and trip_id=p_trip;
 if (p_cash<>cash or p_transfer<>transfer or counted<>expected) and length(trim(p_note))=0 then raise exception 'Las diferencias requieren observación'; end if;
 perform public.inventory_submit_trip(p_tenant,p_trip);
 insert into public.trip_closures(tenant_id,id,trip_id,actor_id,expected_cash,expected_transfer,declared_cash,declared_transfer,expected_stock,declared_stock,note)
 values(p_tenant,p_id,p_trip,auth.uid(),cash,transfer,p_cash,p_transfer,expected,counted,p_note);
 insert into public.owner_notifications(tenant_id,recipient_id,kind,source_id,trip_id)
 select p_tenant,user_id,'trip_closure',p_id,p_trip from public.tenant_members where tenant_id=p_tenant and role='owner' and active;
 return p_id;
end $$;

create function public.trip_review_close(p_tenant uuid,p_id uuid,p_approve boolean,p_note text default '') returns text
language plpgsql security definer set search_path='' as $$
declare c public.trip_closures; decision text; items jsonb;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede aprobar la rendición' using errcode='42501'; end if;
 if p_approve is null or p_note is null or length(p_note)>400 or (not p_approve and length(trim(p_note))=0) then raise exception 'Indicá una decisión y observación válidas'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 select * into c from public.trip_closures where tenant_id=p_tenant and id=p_id;
 if not found then raise exception 'Rendición no encontrada'; end if;
 decision:=case when p_approve then 'approved' else 'observed' end;
 if c.status=decision and c.decided_by=auth.uid() and c.decision_note=p_note then return decision; end if;
 if c.status<>'submitted' then raise exception 'Rendición ya resuelta'; end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=c.trip_id and status='submitted') then raise exception 'Reparto no pendiente'; end if;
 if p_approve and (c.declared_cash<>c.expected_cash or c.declared_transfer<>c.expected_transfer or c.declared_stock<>c.expected_stock) and length(trim(p_note))=0 then raise exception 'Justificá las diferencias antes de aprobar'; end if;
 update public.trip_closures set status=decision,decided_by=auth.uid(),decided_at=now(),decision_note=p_note where tenant_id=p_tenant and id=p_id;
 if p_approve then
  if private.trip_expected_stock(p_tenant,c.trip_id)<>c.declared_stock then raise exception 'Conciliá roturas o faltantes del camión antes de aprobar'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_id',i->>'product_id','quantity',(i->>'ready')::integer)),'[]'::jsonb) into items from jsonb_array_elements(c.declared_stock) i;
  perform public.inventory_post(p_tenant,p_id,'close',c.trip_id,null,items,p_note);
  delete from public.driver_positions where tenant_id=p_tenant and trip_id=c.trip_id;
 else
  update public.inventory_trips set status='active',submitted_at=null where tenant_id=p_tenant and id=c.trip_id;
 end if;
 return decision;
end $$;
create function private.trip_close_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='close' and (exists(select 1 from public.payments where tenant_id=new.tenant_id and trip_id=new.trip_id) or exists(select 1 from public.trip_closures where tenant_id=new.tenant_id and trip_id=new.trip_id))
 and not exists(select 1 from public.trip_closures where tenant_id=new.tenant_id and trip_id=new.trip_id and status='approved' and id=new.id) then raise exception 'Aprobá la rendición de caja antes de cerrar el reparto'; end if;
 return new;
end $$;
create trigger trip_close_guard before insert on public.inventory_operations for each row execute function private.trip_close_guard();
revoke all on function private.trip_close_guard() from public,anon,authenticated;
revoke all on function public.trip_submit_close(uuid,uuid,uuid,numeric,numeric,jsonb,text),public.trip_review_close(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.trip_submit_close(uuid,uuid,uuid,numeric,numeric,jsonb,text),public.trip_review_close(uuid,uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
