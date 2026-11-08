begin;
alter table public.trip_invitations add column generation integer not null default 1 check(generation>0);
alter table public.trip_invitation_events add column generation integer not null default 1;
create function private.stamp_invitation_generation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select generation into new.generation from public.trip_invitations where tenant_id=new.tenant_id and trip_id=new.trip_id;
 return new;
end $$;
revoke all on function private.stamp_invitation_generation() from public,anon,authenticated;
create trigger invitation_event_generation before insert on public.trip_invitation_events for each row execute function private.stamp_invitation_generation();
create table private.trip_driver_changes(tenant_id uuid not null,id uuid not null,trip_id uuid not null,actor_id uuid not null,previous_driver uuid not null,new_driver uuid not null,created_at timestamptz not null default now(),primary key(tenant_id,id));
revoke all on private.trip_driver_changes from public,anon,authenticated;
create function public.owner_change_trip_driver(p_tenant uuid,p_id uuid,p_trip uuid,p_expected uuid,p_driver uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.inventory_trips;previous private.trip_driver_changes;i public.trip_invitations;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede cambiar el chofer' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 if not private.has_role(p_tenant,array['owner']) or p_id is null or p_expected is null or p_driver is null then raise exception 'Solicitud invalida' using errcode='42501';end if;
 select * into previous from private.trip_driver_changes where tenant_id=p_tenant and id=p_id;
 if found then
  if previous.trip_id=p_trip and previous.actor_id=auth.uid() and previous.previous_driver=p_expected and previous.new_driver=p_driver then return p_id;end if;
  raise exception 'Solicitud reutilizada con otros datos';
 end if;
 select * into t from public.inventory_trips where tenant_id=p_tenant and id=p_trip for update;
 if not found or t.removed_at is not null then raise exception 'Reparto no disponible';end if;
 if t.driver_id<>p_expected then raise exception 'El chofer cambio. Actualiza antes de guardar';end if;
 if t.status<>'planned' or t.started_at is not null or exists(select 1 from public.inventory_operations where tenant_id=p_tenant and trip_id=p_trip) or exists(select 1 from public.inventory_truck_stock where tenant_id=p_tenant and trip_id=p_trip and (ready>0 or empties>0)) or exists(select 1 from public.dispensers where tenant_id=p_tenant and trip_id=p_trip and location='truck') or exists(select 1 from public.sales where tenant_id=p_tenant and trip_id=p_trip) or exists(select 1 from public.route_events where tenant_id=p_tenant and trip_id=p_trip and action<>'edit_stop') then raise exception 'Solo se cambia el chofer antes de cargar e iniciar el reparto';end if;
 if p_driver=t.driver_id then raise exception 'Elegi otro chofer';end if;
 if not exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=p_driver and active and (role='driver' or(role='owner' and user_id=auth.uid()))) then raise exception 'Chofer no habilitado en tu lista';end if;
 select * into i from public.trip_invitations where tenant_id=p_tenant and trip_id=p_trip for update;
 if found and i.state<>'revoked' then
  update public.trip_invitations set state='revoked',revoked_at=now() where trip_id=p_trip;
  insert into public.trip_invitation_events(tenant_id,trip_id,actor_id,action) values(p_tenant,p_trip,auth.uid(),'revoked');
 end if;
 update public.inventory_trips set driver_id=p_driver where tenant_id=p_tenant and id=p_trip;
 if p_driver<>auth.uid() then
  insert into public.trip_invitations(tenant_id,trip_id,driver_id,invited_by,state,generation) values(p_tenant,p_trip,p_driver,auth.uid(),'pending',1)
  on conflict(trip_id) do update set driver_id=excluded.driver_id,invited_by=excluded.invited_by,state='pending',generation=public.trip_invitations.generation+1,created_at=now(),answered_at=null,revoked_at=null;
  insert into public.trip_invitation_events(tenant_id,trip_id,actor_id,action) values(p_tenant,p_trip,auth.uid(),'pending');
 end if;
 insert into private.trip_driver_changes(tenant_id,id,trip_id,actor_id,previous_driver,new_driver) values(p_tenant,p_id,p_trip,auth.uid(),t.driver_id,p_driver);
 return p_id;
end $$;
revoke all on function public.owner_change_trip_driver(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.owner_change_trip_driver(uuid,uuid,uuid,uuid,uuid) to authenticated;
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.assistant_answer_trip_invitation(uuid,uuid,boolean,uuid)'::regprocedure);
 if position('e.actor_id<>auth.uid()' in definition)=0 then raise exception 'Contrato de respuesta inesperado';end if;
 definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.assistant_answer_trip_invitation','CREATE OR REPLACE FUNCTION private.answer_trip_invitation_current');
 definition:=replace(definition,'e.actor_id<>auth.uid()','e.generation<>i.generation or e.actor_id<>auth.uid()');
 execute definition;
 definition:=pg_get_functiondef('public.assistant_trip_invitations()'::regprocedure);
 execute replace(definition,'''state'',i.state','''state'',i.state,''generation'',i.generation');
 definition:=pg_get_functiondef('public.owner_trip_invitations(uuid)'::regprocedure);
 if position('where i.tenant_id=p_tenant and t.status' in definition)=0 then raise exception 'Contrato de invitaciones inesperado';end if;
 execute replace(definition,'where i.tenant_id=p_tenant and t.status','where i.tenant_id=p_tenant and t.driver_id=i.driver_id and t.status');
end $$;
revoke all on function private.answer_trip_invitation_current(uuid,uuid,boolean,uuid) from public,anon,authenticated;
create or replace function public.assistant_answer_trip_invitation(p_tenant uuid,p_trip uuid,p_accept boolean,p_request uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if exists(select 1 from public.trip_invitations where tenant_id=p_tenant and trip_id=p_trip and generation>1) then raise exception 'Invitacion actualizada. Actualiza la aplicacion antes de responder';end if;
 return private.answer_trip_invitation_current(p_tenant,p_trip,p_accept,p_request);
end $$;
create function public.assistant_answer_trip_version(p_tenant uuid,p_trip uuid,p_accept boolean,p_request uuid,p_generation integer) returns text language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tenants where id=p_tenant for update;
 if p_generation is null or not exists(select 1 from public.trip_invitations where tenant_id=p_tenant and trip_id=p_trip and driver_id=auth.uid() and generation=p_generation) then raise exception 'La invitacion cambio. Actualiza antes de responder' using errcode='42501';end if;
 return private.answer_trip_invitation_current(p_tenant,p_trip,p_accept,p_request);
end $$;
revoke all on function public.assistant_answer_trip_version(uuid,uuid,boolean,uuid,integer) from public,anon,authenticated;
grant execute on function public.assistant_answer_trip_version(uuid,uuid,boolean,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
