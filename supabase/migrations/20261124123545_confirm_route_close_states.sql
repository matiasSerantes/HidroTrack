begin;
alter table public.route_stops add column closed_unvisited boolean not null default false;
create table private.confirmed_route_close_requests(tenant_id uuid not null,id uuid not null,actor_id uuid not null,request jsonb not null,result jsonb not null,primary key(tenant_id,id));
alter table private.confirmed_route_close_requests enable row level security;
revoke all on private.confirmed_route_close_requests from public,anon,authenticated;
do $patch$ declare definition text;begin
 definition:=pg_get_functiondef('private.owner_close_quote(uuid,uuid)'::regprocedure);
 if position('''pending_visits'',' in definition)=0 then raise exception 'Unexpected close quote contract';end if;
 execute replace(definition,'''pending_visits'',', $replacement$'visit_states',coalesce((select jsonb_agg(jsonb_build_object('customer_id',s.customer_id,'name',c.name,'position',s.position,'outcome',s.outcome,'followup',s.followup,'next_date',s.next_date,'next_time',to_char(s.next_time,'HH24:MI'),'closed_unvisited',s.closed_unvisited) order by s.position,s.customer_id) from public.route_stops s join public.customers c on c.tenant_id=s.tenant_id and c.id=s.customer_id where s.tenant_id=t and s.trip_id=r and c.active and c.removed_at is null and (s.active or s.closed_unvisited)),'[]'::jsonb),'pending_visits',$replacement$);
end $patch$;
create function private.confirm_unvisited_stops(t uuid,r uuid,close_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare stop record;
begin
 for stop in update public.route_stops s set active=false,closed_unvisited=true,version=version+1,updated_at=now() where s.tenant_id=t and s.trip_id=r and s.active and s.outcome in ('pending','present') and exists(select 1 from public.customers c where c.tenant_id=t and c.id=s.customer_id and c.active and c.removed_at is null) returning customer_id,outcome,version loop
  insert into public.route_events(tenant_id,id,trip_id,customer_id,actor_id,action,data) values(t,gen_random_uuid(),r,stop.customer_id,auth.uid(),'edit_stop',jsonb_build_object('action','close_unvisited','close_id',close_id,'outcome',stop.outcome,'result_version',stop.version,'note','Sin resultado final: estado confirmado al cerrar el reparto. No registra visita ni venta.'));
 end loop;
end $$;
revoke all on function private.confirm_unvisited_stops(uuid,uuid,uuid) from public,anon,authenticated;

create function public.owner_finish_self_trip_with_states(p_tenant uuid,p_id uuid,p_trip uuid,p_expected jsonb,p_cash numeric,p_transfer numeric,p_stock jsonb,p_note text default '',p_confirm_unvisited boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.confirmed_route_close_requests;payload jsonb;q jsonb;result jsonb;
begin
 if p_id is null then raise exception 'Cierre invalido';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('kind','owner_finish_self_trip_with_states','trip',p_trip,'expected',p_expected,'cash',p_cash,'transfer',p_transfer,'stock',p_stock,'note',p_note,'confirm_unvisited',p_confirm_unvisited);
 select * into prior from private.confirmed_route_close_requests where tenant_id=p_tenant and id=p_id;
 if found then
  if prior.actor_id=auth.uid() and prior.request=payload then
   if private.has_role(p_tenant,array['owner']) and exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid()) then return coalesce((select snapshot from public.owner_trip_close_snapshots where tenant_id=p_tenant and id=p_id),jsonb_build_object('id',p_id));end if;
   return jsonb_build_object('id',p_id);
  end if;raise exception 'ID de cierre usado con otros datos';
 end if;
 if not (private.has_role(p_tenant,array['owner']) and exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and driver_id=auth.uid())) then raise exception 'Solo el repartidor asignado puede confirmar el cierre' using errcode='42501';end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no activo';end if;
 q:=private.owner_close_quote(p_tenant,p_trip);
 if p_expected is null or q<>p_expected then raise exception 'El reparto cambio; actualiza el resumen';end if;
 if (q->>'pending_visits')::integer>0 then
  if p_confirm_unvisited is distinct from true then raise exception 'Confirma las paradas que quedan sin visitar';end if;
  perform private.confirm_unvisited_stops(p_tenant,p_trip,p_id);
  q:=private.owner_close_quote(p_tenant,p_trip);
 end if;
 result:=public.owner_finish_self_trip(p_tenant,p_id,p_trip,q,p_cash,p_transfer,p_stock,p_note);
 insert into private.confirmed_route_close_requests values(p_tenant,p_id,auth.uid(),payload,result);
 return result;
end $$;
revoke all on function public.owner_finish_self_trip_with_states(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.owner_finish_self_trip_with_states(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text,boolean) to authenticated;

create function public.assistant_submit_close_with_states(p_tenant uuid,p_id uuid,p_trip uuid,p_expected jsonb,p_cash numeric,p_transfer numeric,p_stock jsonb,p_note text default '',p_confirm_unvisited boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.confirmed_route_close_requests;payload jsonb;q jsonb;result jsonb;
begin
 if p_id is null then raise exception 'Cierre invalido';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('kind','assistant_submit_close_with_states','trip',p_trip,'expected',p_expected,'cash',p_cash,'transfer',p_transfer,'stock',p_stock,'note',p_note,'confirm_unvisited',p_confirm_unvisited);
 select * into prior from private.confirmed_route_close_requests where tenant_id=p_tenant and id=p_id;
 if found then
  if prior.actor_id=auth.uid() and prior.request=payload then
   if private.accepted_trip_access(p_tenant,p_trip) then return coalesce((select snapshot from public.assistant_trip_close_snapshots where tenant_id=p_tenant and id=p_id),jsonb_build_object('id',p_id));end if;
   return jsonb_build_object('id',p_id);
  end if;raise exception 'ID de cierre usado con otros datos';
 end if;
 if not (private.accepted_trip_access(p_tenant,p_trip)) then raise exception 'Solo el repartidor asignado puede confirmar el cierre' using errcode='42501';end if;
 if not exists(select 1 from public.inventory_trips where tenant_id=p_tenant and id=p_trip and status='active') then raise exception 'Reparto no activo';end if;
 q:=private.assistant_close_quote(p_tenant,p_trip);
 if p_expected is null or q<>p_expected then raise exception 'El reparto cambio; actualiza el resumen';end if;
 if (q->>'pending_visits')::integer>0 then
  if p_confirm_unvisited is distinct from true then raise exception 'Confirma las paradas que quedan sin visitar';end if;
  perform private.confirm_unvisited_stops(p_tenant,p_trip,p_id);
  q:=private.assistant_close_quote(p_tenant,p_trip);
 end if;
 result:=public.assistant_submit_close(p_tenant,p_id,p_trip,q,p_cash,p_transfer,p_stock,p_note);
 insert into private.confirmed_route_close_requests values(p_tenant,p_id,auth.uid(),payload,result);
 return result;
end $$;
revoke all on function public.assistant_submit_close_with_states(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.assistant_submit_close_with_states(uuid,uuid,uuid,jsonb,numeric,numeric,jsonb,text,boolean) to authenticated;
do $patch$ declare definition text;begin
 definition:=pg_get_functiondef('private.driver_close_receipt(uuid,uuid)'::regprocedure);
 if position('''equipment_detail'',s.snapshot->''equipment_detail''' in definition)=0 then raise exception 'Unexpected driver receipt contract';end if;
 execute replace(definition,'''equipment_detail'',s.snapshot->''equipment_detail''','''equipment_detail'',s.snapshot->''equipment_detail'',''visit_states'',s.snapshot->''visit_states''');
end $patch$;
notify pgrst,'reload schema';
commit;
