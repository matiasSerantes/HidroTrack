-- Ejecutar con psql como postgres en Supabase LOCAL descartable tras la migración.
-- Todo se revierte. Las excepciones inesperadas hacen fallar psql con ON_ERROR_STOP.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','owner-a@example.test'),
 ('10000000-0000-0000-0000-000000000002','owner-b@example.test'),
 ('10000000-0000-0000-0000-000000000003','driver@example.test'),
 ('10000000-0000-0000-0000-000000000004','admin@example.test');
insert into public.tenants(id,name) values
 ('20000000-0000-0000-0000-000000000001','Tenant A'),
 ('20000000-0000-0000-0000-000000000002','Tenant B');
insert into public.licenses(tenant_id,kind,status,driver_limit) select id,'permanent','active',1 from public.tenants where id in ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
insert into public.tenant_members(tenant_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','owner'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','driver');
insert into public.platform_admins(user_id) values('10000000-0000-0000-0000-000000000004');
insert into public.customers(tenant_id,name,address) values
 ('20000000-0000-0000-0000-000000000001','Cliente A','Dirección A'),
 ('20000000-0000-0000-0000-000000000002','Cliente B','Dirección B');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$begin
 if (select count(*) from public.customers) <> 1 then raise exception 'Falla de aislamiento owner'; end if;
 begin
  insert into public.customers(tenant_id,name,address) values('20000000-0000-0000-0000-000000000002','Intrusión','No permitido');
  raise exception 'Se permitió escritura entre tenants';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.tenant_members(tenant_id,user_id,role) values('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','driver');
  raise exception 'Se permitió autoasignación';
 exception when insufficient_privilege then null;
 end;
 if (select count(*) from public.license_events) <> 0 then raise exception 'Owner ve auditoría administrativa'; end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$begin
 if exists(select 1 from public.customers) then raise exception 'Chofer sin asignación ve clientes'; end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
do $$begin
 if exists(select 1 from public.customers) then raise exception 'Superadmin ve datos comerciales'; end if;
end$$;
update public.licenses set status='suspended' where tenant_id='20000000-0000-0000-0000-000000000001';
do $$begin
 if (select count(*) from public.license_events where tenant_id='20000000-0000-0000-0000-000000000001') <> 2 then raise exception 'Falta auditoría'; end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$begin
 if exists(select 1 from public.customers) then raise exception 'Licencia suspendida conserva acceso'; end if;
end$$;
reset role;
-- Relaciones compuestas: un producto ajeno no se puede asociar a un cliente propio.
insert into public.products(id,tenant_id,name,price) values
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Sifón B',2000);
do $$begin
 begin
  insert into public.customer_product_preferences(tenant_id,customer_id,product_id,quantity)
  select tenant_id,id,'30000000-0000-0000-0000-000000000002',2 from public.customers where tenant_id='20000000-0000-0000-0000-000000000001';
  raise exception 'Se permitió relación entre tenants';
 exception when foreign_key_violation then null;
 end;
end$$;
update public.licenses set status='active',kind='monthly',expires_at=now()-interval '1 second' where tenant_id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$begin
 if exists(select 1 from public.customers) then raise exception 'Licencia vencida conserva acceso'; end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin
  perform * from public.customers;
  raise exception 'Anónimo tiene acceso comercial';
 exception when insufficient_privilege then null;
 end;
end$$;
reset role;
rollback;
