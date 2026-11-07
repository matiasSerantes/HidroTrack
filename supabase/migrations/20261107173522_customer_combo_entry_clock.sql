begin;
alter table public.inventory_operations add column device_recorded_at timestamptz;
alter table public.inventory_operations add column device_time_zone text;
create table private.customer_sheet_commands(tenant_id uuid not null,id uuid not null,actor_id uuid not null,request jsonb not null,result jsonb not null,primary key(tenant_id,id));
create table private.customer_combo_corrections(tenant_id uuid not null,id uuid not null,actor_id uuid not null,request jsonb not null,primary key(tenant_id,id));
revoke all on private.customer_sheet_commands,private.customer_combo_corrections from public,anon,authenticated;

create function private.capture_inventory_device_clock() returns trigger language plpgsql set search_path='' as $$
declare clock jsonb;
begin
 clock:=nullif(current_setting('hidrotrack.inventory_device_clock',true),'')::jsonb;
 if clock is not null and clock->>'actor'=auth.uid()::text and new.actor_id=auth.uid() and clock->>'tenant'=new.tenant_id::text then
  new.device_recorded_at:=(clock->>'at')::timestamptz;new.device_time_zone:=clock->>'zone';
 end if;
 return new;
end $$;
revoke all on function private.capture_inventory_device_clock() from public,anon,authenticated;
create trigger inventory_device_clock before insert on public.inventory_operations for each row execute function private.capture_inventory_device_clock();

create function public.inventory_correct_customer_combo(p_tenant uuid,p_id uuid,p_customer uuid,p_combo uuid,p_version integer,p_items jsonb,p_source text,p_date date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.sale_combos; previous private.customer_combo_corrections; payload jsonb; item jsonb; seen uuid[]:='{}'; product uuid; actual bigint; changed boolean:=false;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede corregir envases' using errcode='42501'; end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('customer',p_customer,'combo',p_combo,'version',p_version,'items',p_items,'source',p_source,'date',p_date,'note',p_note);
 select * into previous from private.customer_combo_corrections where tenant_id=p_tenant and id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return p_id; end if;raise exception 'ID de correccion usado con otros datos';end if;
 select * into c from public.sale_combos where tenant_id=p_tenant and id=p_combo;
 if not found or c.version is distinct from p_version then raise exception 'La promo cambio. Actualiza la planilla';end if;
 if p_id is null or p_note is null or length(trim(p_note)) not between 1 and 400 or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<>jsonb_array_length(c.items) then raise exception 'Detalle de correccion invalido';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  product:=(item->>'product_id')::uuid;
  if product is null or product=any(seen) or not exists(select 1 from jsonb_array_elements(c.items) i where i->>'product_id'=product::text) then raise exception 'Articulo ajeno o repetido en la promo';end if;
  seen:=array_append(seen,product);
  if (item->>'expected') is null or (item->>'quantity') is null or (item->>'expected')::numeric not between 0 and 100000 or (item->>'quantity')::numeric not between 0 and 100000 or (item->>'expected')::numeric<>trunc((item->>'expected')::numeric) or (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or not exists(select 1 from public.products where tenant_id=p_tenant and id=product and returnable and family='article') then raise exception 'La correccion admite solo envases retornables';end if;
  select coalesce(sum(m.customer_held),0) into actual from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and o.customer_id=p_customer and m.product_id=product;
  if actual<>(item->>'expected')::integer then raise exception 'La cantidad del cliente cambio. Actualiza la ficha';end if;
  if (item->>'expected')::integer<>(item->>'quantity')::integer then
   perform public.inventory_correct_customer_containers(p_tenant,gen_random_uuid(),p_customer,product,(item->>'expected')::integer,(item->>'quantity')::integer,p_source,p_date,left('Promo '||c.name||': '||p_note,400));changed:=true;
  end if;
 end loop;
 if not changed then raise exception 'La cantidad no cambio';end if;
 insert into private.customer_combo_corrections values(p_tenant,p_id,auth.uid(),payload);
 return p_id;
end $$;

-- A fixed whitelist delegates to existing guarded RPCs; it cannot execute arbitrary SQL.
create function public.owner_customer_sheet_command(p_tenant uuid,p_request uuid,p_action text,p_args jsonb,p_device_at timestamptz,p_device_zone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.customer_sheet_commands; payload jsonb; fn record; args text; result jsonb; old_clock text;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede registrar esta carga' using errcode='42501';end if;
 if p_action is null or p_action not in ('inventory_assign_existing_containers','inventory_record_stock','inventory_correct_customer_containers','inventory_correct_customer_combo','inventory_assign_dispenser_model','inventory_return_dispenser_model','inventory_exchange_dispenser','inventory_save_dispenser','owner_assign_rental_agreement') then raise exception 'Operacion no permitida' using errcode='42501';end if;
 if p_request is null or p_args is null or jsonb_typeof(p_args)<>'object' or p_device_at is null or not isfinite(p_device_at) or p_device_at<timestamptz '1900-01-01 UTC' or p_device_at>=timestamptz '2200-01-01 UTC' or p_device_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_device_zone) then raise exception 'Hora o zona del dispositivo invalida';end if;
 if p_args->>'p_tenant' is distinct from p_tenant::text then raise exception 'Empresa invalida' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('action',p_action,'args',p_args,'device_at',p_device_at,'zone',p_device_zone);
 select * into previous from private.customer_sheet_commands where tenant_id=p_tenant and id=p_request;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return previous.result;end if;raise exception 'ID de carga usado con otros datos';end if;
 select p.oid,p.proargnames,p.proargtypes into strict fn from pg_catalog.pg_proc p where p.pronamespace='public'::regnamespace and p.proname=p_action;
 if exists(select 1 from jsonb_object_keys(p_args) k where not k=any(fn.proargnames)) then raise exception 'Argumento no permitido';end if;
 select string_agg(format('%I => ($1->>%L)::%s',a.name,a.name,pg_catalog.format_type(fn.proargtypes[a.n-1],null)),',' order by a.n) into args from unnest(fn.proargnames) with ordinality a(name,n) where p_args ? a.name;
 old_clock:=current_setting('hidrotrack.inventory_device_clock',true);
 perform set_config('hidrotrack.inventory_device_clock',jsonb_build_object('actor',auth.uid(),'tenant',p_tenant,'at',p_device_at,'zone',p_device_zone)::text,true);
 execute format('select to_jsonb(public.%I(%s))',p_action,args) into result using p_args;
 perform set_config('hidrotrack.inventory_device_clock',coalesce(old_clock,''),true);
 insert into private.customer_sheet_commands values(p_tenant,p_request,auth.uid(),payload,result);
 return result;
end $$;
revoke all on function public.inventory_correct_customer_combo(uuid,uuid,uuid,uuid,integer,jsonb,text,date,text),public.owner_customer_sheet_command(uuid,uuid,text,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.inventory_correct_customer_combo(uuid,uuid,uuid,uuid,integer,jsonb,text,date,text),public.owner_customer_sheet_command(uuid,uuid,text,jsonb,timestamptz,text) to authenticated;
notify pgrst,'reload schema';
commit;
