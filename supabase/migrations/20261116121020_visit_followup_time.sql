begin;
alter table public.route_stops add column next_time time;
create function public.assistant_record_visit_at(p_tenant uuid,p_id uuid,p_trip uuid,p_customer uuid,p_version integer,p_outcome text,p_followup text default null,p_next_date date default null,p_note text default '',p_next_time time default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare stop public.route_stops; previous public.route_events; payload jsonb; service_date date; day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.accepted_trip_access(p_tenant,p_trip) then raise exception 'Reparto no aceptado o acceso finalizado' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_outcome is null or p_outcome not in ('absent','no_purchase') or p_note is null or length(p_note)>400 then raise exception 'Visita invalida'; end if;
 payload:=jsonb_build_object('outcome',p_outcome,'expected_version',p_version,'followup',p_followup,'next_date',p_next_date,'note',p_note,'next_time',p_next_time);
 select * into previous from public.route_events where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.actor_id=auth.uid() and previous.trip_id=p_trip and previous.customer_id=p_customer and previous.action=p_outcome and previous.data-'result_version'=payload then
   return jsonb_build_object('id',p_id,'version',previous.data->'result_version','outcome',p_outcome,'next_date',p_next_date,'next_time',p_next_time);
  end if;
  raise exception 'ID de visita utilizado con otros datos';
 end if;
 select t.service_date into service_date from public.inventory_trips t where tenant_id=p_tenant and id=p_trip and status='active';
 if not found then raise exception 'Reparto no activo'; end if;
 if p_outcome='absent' then
  if p_next_time is null then raise exception 'Elegi la hora para volver'; end if;
  if p_followup is null or p_followup not in ('later_today','date') or p_next_date is null or p_next_date<service_date or (p_followup='later_today' and p_next_date<>day) or (p_followup='date' and p_next_date<=day) then raise exception 'Elegi hoy mas tarde u otro dia futuro'; end if;
 elsif p_followup is not null or p_next_date is not null or p_next_time is not null then raise exception 'No compro no reprograma la visita'; end if;
 select * into stop from public.route_stops where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer and active for update;
 if not found or not exists(select 1 from public.customers where tenant_id=p_tenant and id=p_customer and active) then raise exception 'Cliente no asignado o inactivo' using errcode='42501'; end if;
 if stop.version<>p_version or stop.outcome in ('delivered','no_purchase') then raise exception 'La parada cambio o ya esta resuelta'; end if;
 update public.route_stops set outcome=p_outcome,followup=p_followup,next_date=p_next_date,next_time=p_next_time,version=version+1,updated_at=now() where tenant_id=p_tenant and trip_id=p_trip and customer_id=p_customer returning * into stop;
 insert into public.route_events(tenant_id,id,trip_id,customer_id,actor_id,action,data) values(p_tenant,p_id,p_trip,p_customer,auth.uid(),p_outcome,payload||jsonb_build_object('result_version',stop.version));
 return jsonb_build_object('id',p_id,'version',stop.version,'outcome',p_outcome,'next_date',p_next_date,'next_time',p_next_time);
end $$;


revoke all on function public.assistant_record_visit_at(uuid,uuid,uuid,uuid,integer,text,text,date,text,time) from public,anon,authenticated;
grant execute on function public.assistant_record_visit_at(uuid,uuid,uuid,uuid,integer,text,text,date,text,time) to authenticated;
-- Preserve current access guards and the rest of each response contract.
do $patch$
declare source text;
begin
 source:=pg_get_functiondef('public.assistant_open_trip(uuid,uuid)'::regprocedure);
 if position('''next_date'',r.next_date,' in source)=0 then raise exception 'Unexpected assistant_open_trip contract'; end if;
 execute replace(source,'''next_date'',r.next_date,','''next_date'',r.next_date,''next_time'',to_char(r.next_time,''HH24:MI''),');
 source:=pg_get_functiondef('public.owner_followup_inbox(uuid,integer)'::regprocedure);
 if position('r.next_date,r.followup' in source)=0 then raise exception 'Unexpected owner_followup_inbox contract'; end if;
 execute replace(source,'r.next_date,r.followup','r.next_date,to_char(r.next_time,''HH24:MI'') next_time,r.followup');
end $patch$;
notify pgrst,'reload schema';
commit;
