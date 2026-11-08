begin;
alter table public.customers add column phone2 text not null default '' check(length(phone2)<=40);
alter table public.customers add column phone3 text not null default '' check(length(phone3)<=40);
alter table public.customers add column delivery_notes text not null default '' check(length(delivery_notes)<=500);
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.assistant_customer_visit(uuid,uuid,uuid)'::regprocedure);
 if position('return result||jsonb_build_object(''combos'',combos);' in definition)=0 then raise exception 'Contrato de planilla inesperado';end if;
 execute replace(definition,'return result||jsonb_build_object(''combos'',combos);',
 'result:=result||jsonb_build_object(''customer'',(result->''customer'')||(select jsonb_build_object(''phone'',c.phone,''phone2'',c.phone2,''phone3'',c.phone3,''delivery_notes'',c.delivery_notes) from public.customers c where c.tenant_id=p_tenant and c.id=p_customer));return result||jsonb_build_object(''combos'',combos);');
 definition:=pg_get_functiondef('public.customer_set_visit_window(uuid,uuid,time,time)'::regprocedure);
 if position('if p_start is null or p_end is null' in definition)=0 then raise exception 'Contrato de horario inesperado';end if;
 execute replace(definition,'if p_start is null or p_end is null','if p_start is not null and p_end is null then p_end:=time ''23:59:59'';end if; if p_start is null or p_end is null');
end $$;

create table private.inventory_total_corrections(tenant_id uuid not null,id uuid not null,actor_id uuid not null,request jsonb not null,primary key(tenant_id,id));
revoke all on private.inventory_total_corrections from public,anon,authenticated;
create function public.inventory_set_owned_total(p_tenant uuid,p_id uuid,p_product uuid,p_expected bigint,p_total bigint,p_source text,p_date date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous private.inventory_total_corrections; payload jsonb; actual bigint; delta bigint; p public.products;
begin
 if not private.has_role(p_tenant,array['owner']) then raise exception 'Solo el jefe puede corregir inventario' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('product',p_product,'expected',p_expected,'total',p_total,'source',p_source,'date',p_date,'note',p_note);
 select * into previous from private.inventory_total_corrections where tenant_id=p_tenant and id=p_id;
 if found then if previous.actor_id=auth.uid() and previous.request=payload then return p_id;end if;raise exception 'ID de ajuste utilizado con otros datos';end if;
 if p_id is null or p_expected is null or p_total is null or p_total<0 or p_total>1000000000 or p_source is null or p_source not in ('depot_empty','depot_ready') or p_note is null or length(trim(p_note)) not between 1 and 360 then raise exception 'Total o motivo invalido';end if;
 select * into p from public.products where tenant_id=p_tenant and id=p_product and active;
 if not found or (p_source='depot_empty' and (not p.returnable or p.family='dispenser')) then raise exception 'Origen no disponible para ese articulo';end if;
 select coalesce(total_owned,0) into actual from public.inventory_owned_stock where tenant_id=p_tenant and product_id=p_product;
 actual:=coalesce(actual,0);if actual<>p_expected then raise exception 'El inventario cambio. Actualiza antes de corregir el total';end if;
 delta:=p_total-actual;if delta=0 or abs(delta)>100000 then raise exception 'Indica un cambio de hasta 100000 unidades';end if;
 if delta>0 then
  perform public.inventory_record_stock(p_tenant,p_id,case when p_source='depot_empty' then 'receive_empty' else 'receive' end,null,null,jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',delta)),'Correccion de total: '||p_note,p_date);
 else
  perform public.inventory_remove(p_tenant,p_id,'remove',p_product,(-delta)::integer,p_source,null,null,p_date,'owner',auth.uid(),'Correccion de total: '||p_note);
 end if;
 insert into private.inventory_total_corrections values(p_tenant,p_id,auth.uid(),payload);return p_id;
end $$;
revoke all on function public.inventory_set_owned_total(uuid,uuid,uuid,bigint,bigint,text,date,text) from public,anon,authenticated;
grant execute on function public.inventory_set_owned_total(uuid,uuid,uuid,bigint,bigint,text,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
