begin;
create function private.trip_equipment_close_detail(t uuid,r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with model_events as (
  select e.id,e.created_at,jsonb_build_object('id',e.id,'date',e.occurred_on,'kind','exchanged','name',old.name,'replacement',new.name,'quantity',1,'state',e.returned_state) item
  from public.dispenser_exchanges e join public.products old on old.tenant_id=e.tenant_id and old.id=e.old_product join public.products new on new.tenant_id=e.tenant_id and new.id=e.new_product where e.tenant_id=t and e.trip_id=r
  union all
  select o.id,o.created_at,jsonb_build_object('id',o.id,'date',o.occurred_on,'kind',case o.kind when 'dispenser_assign' then 'assigned' when 'dispenser_return' then 'returned' when 'damage' then 'damaged' else 'removed' end,'name',p.name,'quantity',greatest(abs(m.truck_ready),abs(m.customer_held)))
  from public.inventory_operations o join public.inventory_movements m on m.tenant_id=o.tenant_id and m.operation_id=o.id join public.products p on p.tenant_id=m.tenant_id and p.id=m.product_id
  where o.tenant_id=t and o.trip_id=r and p.family='dispenser' and o.kind in ('dispenser_assign','dispenser_return','damage','remove')
   and not exists(select 1 from public.dispenser_exchanges e where e.tenant_id=t and (e.id=o.id or e.replacement_operation=o.id))
 ), serial_events as (
  select e.id,e.created_at,jsonb_build_object('id',e.id,'date',coalesce(e.occurred_on,(e.created_at at time zone 'America/Argentina/Buenos_Aires')::date),'kind',case
   when e.new_value->>'retired'='true' and coalesce(e.old_value->>'retired','false')<>'true' then 'damaged'
   when e.new_value->>'location'='truck' and e.new_value->>'trip_id'=r::text then 'loaded'
   when e.new_value->>'location'='customer' then 'assigned'
   when e.new_value->>'location'='depot' then 'returned' else 'moved' end,
   'name',coalesce(nullif(e.new_value->>'name',''),e.old_value->>'name','Dispenser'),'serial',coalesce(e.new_value->>'serial',e.old_value->>'serial',''),'quantity',1) item
  from public.dispenser_events e where e.tenant_id=t and (e.old_value->>'trip_id'=r::text or e.new_value->>'trip_id'=r::text)
   and coalesce(e.new_value->>'ownership',e.old_value->>'ownership')='company'
   and ((e.old_value->>'location',e.old_value->>'trip_id') is distinct from (e.new_value->>'location',e.new_value->>'trip_id') or (e.new_value->>'retired'='true' and coalesce(e.old_value->>'retired','false')<>'true'))
 )
 select jsonb_build_object('version',1,'models',coalesce((select jsonb_agg(item order by created_at,id,item->>'name') from model_events),'[]'::jsonb),'serialized',coalesce((select jsonb_agg(item order by created_at,id) from serial_events),'[]'::jsonb));
$$;
revoke all on function private.trip_equipment_close_detail(uuid,uuid) from public,anon,authenticated;

-- Same quote contract with an additional immutable-at-submit field. No changes
-- to existing snapshots, inventory writes, rental anchors or access helpers.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('private.owner_close_quote(uuid,uuid)'::regprocedure);
 if position('''revision'',jsonb_build_object' in definition)=0 then raise exception 'Contrato de resumen inesperado'; end if;
 definition:=replace(definition,'''revision'',jsonb_build_object','''equipment_detail'',private.trip_equipment_close_detail(t,r),''revision'',jsonb_build_object');
 execute definition;
 -- Old submitted snapshots keep their original comparison rules and payload.
 definition:=pg_get_functiondef('public.trip_review_close(uuid,uuid,boolean,text)'::regprocedure);
 if position('if q<>expected then' in definition)=0 then raise exception 'Contrato de revision inesperado'; end if;
 definition:=replace(definition,'if q<>expected then','if (case when expected ? ''equipment_detail'' then q else q-''equipment_detail'' end)<>expected then');
 execute definition;
 definition:=pg_get_functiondef('private.driver_close_receipt(uuid,uuid)'::regprocedure);
 if position('''decision_note'',s.snapshot->''decision_note''' in definition)=0 then raise exception 'Contrato de comprobante inesperado'; end if;
 definition:=replace(definition,'''decision_note'',s.snapshot->''decision_note''','''decision_note'',s.snapshot->''decision_note'',''equipment_detail'',s.snapshot->''equipment_detail''');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
