begin;
create or replace function private.inventory_actor_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.tenant_members where tenant_id=new.tenant_id and user_id=new.actor_id)
 and not(new.actor_id=auth.uid() and private.is_admin() and new.kind in ('refill','close','receive','receive_empty','remove','opening_customer')) then raise exception 'Actor ajeno al inventario' using errcode='42501';end if;
 return new;
end $$;
create function public.admin_set_license(p_tenant uuid,p_id uuid,p_expected jsonb,p_values jsonb,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.admin_support_operations;current_license jsonb;payload jsonb;result jsonb;license_kind text;license_status text;plan text;expires timestamptz;driver_count numeric;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;if not found then raise exception 'Empresa no disponible';end if;
 payload:=jsonb_build_object('kind','license','expected',p_expected,'values',p_values,'note',p_note);
 select * into old from private.admin_support_operations where tenant_id=p_tenant and id=p_id;
 if found then if old.actor_id=auth.uid() and old.request=payload then return old.result;end if;raise exception 'ID usado con otros datos';end if;
 if p_id is null or p_values is null or jsonb_typeof(p_values)<>'object' or p_values-'kind'-'status'-'expires_at'-'driver_limit'-'driver_plan'<>'{}'::jsonb or p_note is null or length(p_note)>360 then raise exception 'Datos de licencia invalidos';end if;
 select to_jsonb(l) into current_license from public.licenses l where tenant_id=p_tenant for update;
 if current_license is distinct from p_expected then raise exception 'La licencia cambio; actualiza la cuenta antes de asignar';end if;
 license_kind:=p_values->>'kind';license_status:=p_values->>'status';plan:=coalesce(p_values->>'driver_plan',current_license->>'driver_plan','basic');driver_count:=(p_values->>'driver_limit')::numeric;expires:=(p_values->>'expires_at')::timestamptz;
 if license_kind is null or license_kind not in ('monthly','permanent') or license_status is null or license_status not in ('active','suspended') or plan not in ('custom','basic','intermediate','unlimited') or driver_count is null or driver_count::text in ('NaN','Infinity','-Infinity') or driver_count not between 0 and 10000 or driver_count<>trunc(driver_count) then raise exception 'Plan o cupo invalido';end if;
 if license_kind='permanent' then expires:=null;elsif expires is null or not isfinite(expires) or expires>timestamptz '2100-12-31' or (license_status='active' and expires<=now()) then raise exception 'Elige un vencimiento futuro para activar la licencia mensual';end if;
 if current_license is null then
  insert into public.licenses(tenant_id,kind,status,driver_plan,driver_limit,expires_at) values(p_tenant,license_kind,license_status,plan,driver_count::integer,expires);
 else
  update public.licenses set kind=license_kind,status=license_status,driver_plan=plan,driver_limit=driver_count::integer,expires_at=expires where tenant_id=p_tenant;
 end if;
 result:=jsonb_build_object('id',p_id,'tenant_id',p_tenant,'before',current_license,'license',(select to_jsonb(l) from public.licenses l where tenant_id=p_tenant));
 insert into private.admin_support_operations values(p_tenant,p_id,auth.uid(),payload,result,now());return result;
end $$;
create function private.admin_post_depot_delta(t uuid,product uuid,delta bigint,empty_state boolean,occurred date,note text) returns uuid language plpgsql security definer set search_path='' as $$
declare operation uuid:=gen_random_uuid();begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 if delta=0 then return null;end if;
 insert into public.inventory_operations(tenant_id,id,actor_id,kind,items,source,note,occurred_on)
 values(t,operation,auth.uid(),case when delta<0 then 'remove' when empty_state then 'receive_empty' else 'receive' end,jsonb_build_array(jsonb_build_object('product_id',product,'quantity',abs(delta))),case when delta<0 then case when empty_state then 'depot_empty' else 'depot_ready' end else null end,note,occurred);
 insert into public.inventory_movements(tenant_id,operation_id,product_id,depot_ready,depot_empty,unit_price) select t,operation,id,case when empty_state then 0 else delta end,case when empty_state then delta else 0 end,price from public.products where tenant_id=t and id=product;
 return operation;
end $$;
revoke all on function private.admin_post_depot_delta(uuid,uuid,bigint,boolean,date,text) from public,anon,authenticated;
create function public.admin_set_depot_counts(p_tenant uuid,p_id uuid,p_product uuid,p_expected_ready bigint,p_expected_empty bigint,p_ready bigint,p_empty bigint,p_date date,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.admin_support_operations;payload jsonb;result jsonb;product public.products;ready bigint;empties bigint;first_op uuid;second_op uuid;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('kind','depot_count','product',p_product,'expected_ready',p_expected_ready,'expected_empty',p_expected_empty,'ready',p_ready,'empty',p_empty,'date',p_date,'note',p_note);
 select * into old from private.admin_support_operations where tenant_id=p_tenant and id=p_id;
 if found then if old.actor_id=auth.uid() and old.request=payload then return old.result;end if;raise exception 'ID usado con otros datos';end if;
 if p_id is null or p_ready is null or p_empty is null or p_ready not between 0 and 1000000000 or p_empty not between 0 and 1000000000 or p_date is null or not isfinite(p_date) or p_date<date '1900-01-01' or p_date>(now() at time zone 'America/Argentina/Buenos_Aires')::date or p_note is null or length(p_note)>360 then raise exception 'Cantidades, fecha o referencia invalidas';end if;
 select * into product from public.products where tenant_id=p_tenant and id=p_product for share;
 if not found or (p_empty>0 and (not product.returnable or product.family='dispenser')) then raise exception 'Estado no disponible para este articulo';end if;
 select coalesce(sum(depot_ready),0),coalesce(sum(depot_empty),0) into ready,empties from public.inventory_movements where tenant_id=p_tenant and product_id=p_product;
 if p_expected_ready is distinct from ready or p_expected_empty is distinct from empties then raise exception 'El deposito cambio; actualiza antes de corregir';end if;
 if not product.active and (p_ready>ready or p_empty>empties) then raise exception 'Solo se pueden reducir existencias de un modelo archivado';end if;
 if abs(p_ready-ready)>100000 or abs(p_empty-empties)>100000 or (p_ready=ready and p_empty=empties) then raise exception 'Sin cambios o diferencia superior a 100000 por estado';end if;
 first_op:=private.admin_post_depot_delta(p_tenant,p_product,p_ready-ready,false,p_date,'Correccion de soporte: '||coalesce(nullif(trim(p_note),''),'Conteo informado por el titular'));
 second_op:=private.admin_post_depot_delta(p_tenant,p_product,p_empty-empties,true,p_date,'Correccion de soporte: '||coalesce(nullif(trim(p_note),''),'Conteo informado por el titular'));
 result:=jsonb_build_object('id',p_id,'before',jsonb_build_object('ready',ready,'empties',empties),'after',jsonb_build_object('ready',p_ready,'empties',p_empty),'total_difference',p_ready+p_empty-ready-empties,'operations',jsonb_build_array(first_op,second_op));
 insert into private.admin_support_operations values(p_tenant,p_id,auth.uid(),payload,result,now());return result;
end $$;
-- Same stock-conservation and recovery rules as the owner's correction, with
-- a separate private entry point that records the real support administrator.
do $patch$ declare def text;begin
 def:=pg_get_functiondef('public.inventory_correct_customer_containers(uuid,uuid,uuid,uuid,integer,integer,text,date,text)'::regprocedure);
 if position('not private.has_role(p_tenant,array[''owner''])' in def)=0 then raise exception 'Unexpected customer correction contract';end if;
 def:=replace(def,'public.inventory_correct_customer_containers','private.admin_correct_customer_core');
 def:=replace(def,'not private.has_role(p_tenant,array[''owner''])','not private.is_admin()');
 def:=replace(def,'Solo el jefe puede corregir envases','Solo superadministracion');execute def;
end $patch$;
revoke all on function private.admin_correct_customer_core(uuid,uuid,uuid,uuid,integer,integer,text,date,text) from public,anon,authenticated;
create function public.admin_correct_customer_stock(p_tenant uuid,p_id uuid,p_customer uuid,p_product uuid,p_expected integer,p_quantity integer,p_source text,p_date date,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.admin_support_operations;payload jsonb;result jsonb;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for update;
 payload:=jsonb_build_object('kind','customer_stock','customer',p_customer,'product',p_product,'expected',p_expected,'quantity',p_quantity,'source',p_source,'date',p_date,'note',p_note);
 select * into old from private.admin_support_operations where tenant_id=p_tenant and id=p_id;
 if found then if old.actor_id=auth.uid() and old.request=payload then return old.result;end if;raise exception 'ID usado con otros datos';end if;
 if p_note is null or length(p_note)>360 then raise exception 'Referencia invalida';end if;
 perform private.admin_correct_customer_core(p_tenant,p_id,p_customer,p_product,p_expected,p_quantity,p_source,p_date,'Soporte: '||coalesce(nullif(trim(p_note),''),'Correccion solicitada por el titular'));
 result:=jsonb_build_object('id',p_id,'before',p_expected,'after',p_quantity,'source',p_source);
 insert into private.admin_support_operations values(p_tenant,p_id,auth.uid(),payload,result,now());return result;
end $$;
create function public.admin_customer_support(p_tenant uuid,p_search text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q text:=lower(trim(coalesce(p_search,'')));result jsonb;begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501';end if;
 if length(q)>150 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Busqueda o pagina invalida';end if;
 with matches as materialized(select * from public.customers c where c.tenant_id=p_tenant and c.removed_at is null and (q='' or position(q in lower(concat_ws(' ',c.name,c.address,c.phone,c.phone2,c.phone3,c.phone4,c.phone5,c.phone6)))>0)),page as(select * from matches order by name,id limit 25 offset p_offset)
 select jsonb_build_object('count',(select count(*) from matches),'items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'active',c.active,'pending_recovery',c.pending_recovery,
 'balance',(select coalesce(sum(total),0) from public.sales where tenant_id=p_tenant and customer_id=c.id)-(select coalesce(sum(pay.amount),0) from public.payments pay join public.sales sale on sale.tenant_id=pay.tenant_id and sale.id=pay.sale_id where pay.tenant_id=p_tenant and sale.customer_id=c.id),
 'held',coalesce((select jsonb_agg(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',coalesce((select sum(m.customer_held) from public.inventory_movements m join public.inventory_operations o on o.tenant_id=m.tenant_id and o.id=m.operation_id where m.tenant_id=p_tenant and m.product_id=p.id and o.customer_id=c.id),0)) order by p.name,p.id) from public.products p where p.tenant_id=p_tenant and p.family='article' and p.returnable),'[]'::jsonb),
 'dispensers',coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'mode',a.mode,'date',a.occurred_on)) from public.dispenser_assignments a join public.products p on p.tenant_id=a.tenant_id and p.id=a.product_id where a.tenant_id=p_tenant and a.customer_id=c.id and a.status='active'),'[]'::jsonb)) order by c.name,c.id) from page c),'[]'::jsonb)) into result;
 return result;
end $$;
do $patch$ declare def text;begin
 def:=pg_get_functiondef('public.admin_company_operations(uuid)'::regprocedure);
 if position('p.active and p.returnable and p.family=''article''' in def)=0 then raise exception 'Unexpected admin inventory contract';end if;
 def:=replace(def,'select p.id,p.name,coalesce','select p.id,p.name,p.family,p.returnable,p.active,coalesce');
 def:=replace(def,'p.active and p.returnable and p.family=''article''','true');
 def:=replace(def,'group by p.id,p.name','group by p.id,p.name,p.family,p.returnable,p.active');execute def;
end $patch$;
revoke all on function public.admin_set_license(uuid,uuid,jsonb,jsonb,text),public.admin_set_depot_counts(uuid,uuid,uuid,bigint,bigint,bigint,bigint,date,text),public.admin_correct_customer_stock(uuid,uuid,uuid,uuid,integer,integer,text,date,text),public.admin_customer_support(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.admin_set_license(uuid,uuid,jsonb,jsonb,text),public.admin_set_depot_counts(uuid,uuid,uuid,bigint,bigint,bigint,bigint,date,text),public.admin_correct_customer_stock(uuid,uuid,uuid,uuid,integer,integer,text,date,text),public.admin_customer_support(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
