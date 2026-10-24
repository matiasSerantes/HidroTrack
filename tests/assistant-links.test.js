import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
const db=new PGlite();
const owner='00000000-0000-0000-0000-000000000001',otherOwner='00000000-0000-0000-0000-000000000002',driver='00000000-0000-0000-0000-000000000003',second='00000000-0000-0000-0000-000000000004',unconfirmed='00000000-0000-0000-0000-000000000005';
const tenant='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
async function actor(id){await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',true); set local role authenticated;`);}
async function link(t,u,active=true,request=crypto.randomUUID()){return db.query('select public.owner_set_assistant_link($1,$2,$3,$4) as id',[t,`HT-${u}`,active,request]);}
async function assigned(){
 await actor(owner);await link(tenant,driver);
 const customer=(await db.query('select id from public.customers where tenant_id=$1',[tenant])).rows[0].id;
 const trip=crypto.randomUUID();await db.query('select public.inventory_create_trip($1,$2,$3,$4,current_date,$5)',[tenant,trip,driver,'Ruta de prueba',[customer]]);return trip;
}
async function answer(trip,accept=true,request=crypto.randomUUID()){return db.query('select public.assistant_answer_trip_invitation($1,$2,$3,$4) as state',[tenant,trip,accept,request]);}
async function preview(trip){return db.query('select public.assistant_open_trip($1,$2) as result',[tenant,trip]);}
async function denied(action,pattern){await db.exec('savepoint denied');await expect(action()).rejects.toThrow(pattern);await db.exec('rollback to savepoint denied; release savepoint denied');}
async function extraVisit(customer){
 await actor(owner);const id=crypto.randomUUID(),product=crypto.randomUUID();
 await db.query("select public.inventory_create_product($1,$2,'Agua extra',100,'unidad',true)",[tenant,product]);
 const customerId=customer??(await db.query('select id from public.customers where tenant_id=$1 order by name limit 1',[tenant])).rows[0].id;
 const items=JSON.stringify([{product_id:product,quantity:2}]);
 await db.query("select public.owner_request_extra_visit($1,$2,$3,current_date,$4,'Llamo antes de la visita')",[tenant,id,customerId,items]);return {id,customer:customerId,items};
}
async function dispenserContract(){
 await actor(owner);const old=crypto.randomUUID(),replacement=crypto.randomUUID(),assignment=crypto.randomUUID(),customer=(await db.query('select id from public.customers where tenant_id=$1 order by name limit 1',[tenant])).rows[0].id;
 for(const product of [old,replacement]){
  await db.query("select public.catalog_create_item($1,$2,'Dispenser',0,'unidad',false,'dispenser')",[tenant,product]);
  await db.query("select public.inventory_record_stock($1,$2,'receive',null,null,$3,'',current_date-10)",[tenant,crypto.randomUUID(),JSON.stringify([{product_id:product,quantity:1}])]);
 }
 await db.query("select public.inventory_assign_dispenser_model($1,$2,$3,$4,'rental',1000,current_date-10,null)",[tenant,assignment,old,customer]);
 return {old,replacement,assignment,customer};
}
async function exchange(v,{id=crypto.randomUUID(),send=crypto.randomUUID(),state='good',trip=null}={}){
 await db.query("select public.inventory_exchange_dispenser($1,$2,$3,$4,$5,case when $8::uuid is not null then current_date else current_date-1 end,$6,$7,'Cambio de prueba',$8)",[tenant,id,send,v.assignment,v.replacement,state,state==='broken'?'customer':null,trip]);return {id,send};
}
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon;`);
 for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
beforeEach(async()=>{
 await db.exec(`begin; insert into auth.users(id,email_confirmed_at) values('${owner}',now()),('${otherOwner}',now()),('${driver}',now()),('${second}',now()),('${unconfirmed}',null);
 insert into public.tenants(id,name) values('${tenant}','Empresa A'),('${other}','Empresa B');
 insert into public.licenses(tenant_id,kind,status,driver_limit) values('${tenant}','permanent','active',1),('${other}','permanent','active',1);
 insert into public.tenant_members(tenant_id,user_id,role) values('${tenant}','${owner}','owner'),('${other}','${otherOwner}','owner');
 insert into public.customers(tenant_id,name,address) values('${tenant}','Cliente A','Direccion A'),('${other}','Cliente B','Direccion B');`);
});
afterEach(async()=>{await db.exec('rollback; reset role;');});
it('preserva identidad y vinculo con otro jefe al quitar de una lista',async()=>{
 await actor(owner);await link(tenant,driver);await actor(otherOwner);await link(other,driver);
 await actor(driver);expect((await db.query('select public.assistant_my_chiefs() as chiefs')).rows[0].chiefs).toHaveLength(2);
 expect((await db.query('select * from public.licenses')).rows).toHaveLength(0);
 expect((await db.query('select * from public.customers')).rows).toHaveLength(0);
 await actor(owner);await link(tenant,driver,false);await actor(driver);
 expect((await db.query('select public.assistant_my_chiefs() as chiefs')).rows[0].chiefs).toHaveLength(1);
 await db.exec('reset role');expect((await db.query('select * from auth.users where id=$1',[driver])).rows).toHaveLength(1);
});
it('reintento idempotente no duplica membresia ni auditoria',async()=>{
 await actor(owner);const request=crypto.randomUUID();await link(tenant,driver,true,request);await link(tenant,driver,true,request);
 expect((await db.query('select * from public.assistant_link_events')).rows).toHaveLength(1);
 const directory=(await db.query('select public.owner_assistant_directory($1) as d',[tenant])).rows[0].d;
 expect(directory.members).toHaveLength(1);expect(directory.license.limit).toBe(1);
});
it('el servidor impide superar cupo aunque se omita la interfaz',async()=>{
 await actor(owner);await link(tenant,driver);
 await expect(link(tenant,second)).rejects.toThrow(/limite de asistentes/);
});
it('soporta ilimitados sin cupo ficticio y bloquea bajar a un plan insuficiente',async()=>{
 await db.exec(`update public.licenses set driver_plan='unlimited' where tenant_id='${tenant}'`);
 await actor(owner);await link(tenant,driver);await link(tenant,second);
 expect((await db.query('select public.owner_assistant_directory($1) as d',[tenant])).rows[0].d.license.limit).toBe(null);
 await db.exec('reset role');await expect(db.exec(`update public.licenses set driver_plan='basic' where tenant_id='${tenant}'`)).rejects.toThrow(/limite es menor/);
});
it('rechaza cuenta sin confirmar y acceso de otra empresa',async()=>{
 await actor(driver);await db.exec('savepoint denied');await expect(link(tenant,second)).rejects.toThrow(/Acceso denegado/);await db.exec('rollback to savepoint denied');
 await actor(owner);await expect(link(tenant,unconfirmed)).rejects.toThrow(/cuenta verificada/);
});
it('no permite quitar mientras tiene reparto sin cerrar',async()=>{
 await actor(owner);await link(tenant,driver);await db.exec('reset role');
 await db.exec(`insert into public.inventory_trips(tenant_id,driver_id,name,service_date) values('${tenant}','${driver}','Reparto de prueba',current_date)`);
 await actor(owner);await expect(link(tenant,driver,false)).rejects.toThrow(/Cerra los repartos/);
});
it('bloquea acceso por asignacion antigua y conserva nombres de jefes',async()=>{
 await actor(owner);await link(tenant,driver);await db.exec('reset role');
 await db.exec(`insert into public.inventory_trips(tenant_id,driver_id,name,service_date) values('${tenant}','${driver}','Asignacion antigua',current_date)`);
 await actor(driver);
 expect((await db.query('select * from public.inventory_trips')).rows).toHaveLength(0);
 expect((await db.query('select * from public.customers')).rows).toHaveLength(0);
 expect((await db.query('select public.assistant_my_chiefs() as chiefs')).rows[0].chiefs).toHaveLength(1);
});
it('la invitacion pendiente solo expone remitente y nombre, no la cartera',async()=>{
 const trip=await assigned();await actor(driver);
 const invites=(await db.query('select public.assistant_trip_invitations() as items')).rows[0].items;
 expect(invites).toHaveLength(1);expect(invites[0].state).toBe('pending');expect(invites[0]).not.toHaveProperty('stops');expect(JSON.stringify(invites)).not.toContain('Direccion A');
 await denied(()=>preview(trip),/Reparto no aceptado/);
});
it('solo el destinatario puede responder y otro jefe no puede retirar',async()=>{
 const trip=await assigned();await actor(second);await denied(()=>answer(trip),/Invitacion no disponible/);
 await actor(otherOwner);await denied(()=>db.query('select public.owner_revoke_trip_invitation($1,$2,$3)',[tenant,trip,crypto.randomUUID()]),/Acceso denegado/);
});
it('aceptar habilita solo resumen asignado y no reabre operaciones antiguas',async()=>{
 const trip=await assigned();await actor(driver);const request=crypto.randomUUID();await answer(trip,true,request);await answer(trip,true,request);
 const result=(await preview(trip)).rows[0].result;expect(result.stops).toHaveLength(1);expect(result.stops[0].name).toBe('Cliente A');expect(JSON.stringify(result)).not.toContain('Cliente B');
 expect((await db.query('select * from public.customers')).rows).toHaveLength(0);
 await denied(()=>db.query('select public.route_manifest($1,$2)',[tenant,trip]),/Reparto no asignado/);
 await denied(()=>db.query('select public.route_publish_position($1,$2,0,0,1)',[tenant,trip]),/Solo el repartidor/);
 await actor(second);await denied(()=>preview(trip),/Reparto no aceptado/);
 await actor(owner);expect((await db.query("select * from public.trip_invitation_events where action='accepted'")).rows).toHaveLength(1);
});
it('rechazar no habilita clientes y permite quitar vinculo sin carga pendiente',async()=>{
 const trip=await assigned();await actor(driver);await answer(trip,false);await denied(()=>preview(trip),/Reparto no aceptado/);
 await actor(owner);await link(tenant,driver,false);
});
it('revocar retira acceso e impide restaurarlo con el reintento de aceptar',async()=>{
 const trip=await assigned();await actor(driver);const request=crypto.randomUUID();await answer(trip,true,request);
 await actor(owner);await db.query('select public.owner_revoke_trip_invitation($1,$2,$3)',[tenant,trip,crypto.randomUUID()]);
 await actor(driver);await denied(()=>preview(trip),/Reparto no aceptado/);expect((await answer(trip,true,request)).rows[0].state).toBe('revoked');
 await denied(()=>answer(trip,true),/respondida o revocada/);
});
it('cerrar reparto o suspender licencia retira acceso al resumen',async()=>{
 const trip=await assigned();await actor(driver);await answer(trip);
 await db.exec(`reset role; update public.licenses set status='suspended' where tenant_id='${tenant}'`);await actor(driver);await denied(()=>preview(trip),/Reparto no aceptado/);
 await db.exec(`reset role; update public.licenses set status='active' where tenant_id='${tenant}'; update public.inventory_trips set status='closed',started_at=now(),submitted_at=now(),closed_at=now() where id='${trip}'`);
 await actor(driver);await denied(()=>preview(trip),/Reparto no aceptado/);expect((await db.query('select public.assistant_trip_invitations() as items')).rows[0].items).toHaveLength(0);
});
it('el jefe no puede cargar un camion pendiente de aceptacion',async()=>{
 const trip=await assigned();await actor(owner);const product=crypto.randomUUID();
 await db.query("select public.inventory_create_product($1,$2,'Agua',100,'unidad',true)",[tenant,product]);
 const items=JSON.stringify([{product_id:product,quantity:2}]);
 await db.query("select public.inventory_post($1,$2,'receive',null,null,$3,'')",[tenant,crypto.randomUUID(),items]);
 await denied(()=>db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),trip,items]),/debe aceptar/);
 await actor(driver);await answer(trip);await actor(owner);
 await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),trip,items]);
});
it('solicitud extraordinaria es idempotente y no registra stock ni venta',async()=>{
 const v=await extraVisit();await db.query("select public.owner_request_extra_visit($1,$2,$3,current_date,$4,'Llamo antes de la visita')",[tenant,v.id,v.customer,v.items]);
 expect((await db.query('select * from public.extra_visit_events')).rows).toHaveLength(1);
 expect((await db.query('select * from public.inventory_operations')).rows).toHaveLength(0);
 expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
});
it('asistente y otro jefe no pueden leer o crear pedidos de la empresa',async()=>{
 const v=await extraVisit();await actor(driver);expect((await db.query('select * from public.extra_visit_requests')).rows).toHaveLength(0);
 await denied(()=>db.query("select public.owner_request_extra_visit($1,$2,$3,current_date,$4,'')",[tenant,crypto.randomUUID(),v.customer,v.items]),/Acceso denegado/);
 await actor(otherOwner);expect((await db.query('select * from public.extra_visit_requests')).rows).toHaveLength(0);
});
it('asignar pedido no duplica parada existente ni suma stock',async()=>{
 const trip=await assigned(),v=await extraVisit();const event=crypto.randomUUID();
 await db.query("select public.owner_manage_extra_visit($1,$2,$3,'assigned',$4)",[tenant,event,v.id,trip]);
 await db.query("select public.owner_manage_extra_visit($1,$2,$3,'assigned',$4)",[tenant,event,v.id,trip]);
 expect((await db.query('select * from public.route_stops where trip_id=$1',[trip])).rows).toHaveLength(1);
 expect((await db.query('select * from public.extra_visit_requests')).rows[0].state).toBe('assigned');
 expect((await db.query('select * from public.inventory_operations')).rows).toHaveLength(0);
});
it('agrega cliente nuevo al recorrido y cancelar preserva parada e historial',async()=>{
 const trip=await assigned(),customer=crypto.randomUUID();await db.exec('reset role');await db.query("insert into public.customers(id,tenant_id,name,address) values($1,$2,'Nuevo','Direccion nueva')",[customer,tenant]);
 const v=await extraVisit(customer);await db.query("select public.owner_manage_extra_visit($1,$2,$3,'assigned',$4)",[tenant,crypto.randomUUID(),v.id,trip]);
 expect((await db.query('select * from public.route_stops where trip_id=$1',[trip])).rows).toHaveLength(2);
 await db.query("select public.owner_manage_extra_visit($1,$2,$3,'cancelled',null)",[tenant,crypto.randomUUID(),v.id]);
 expect((await db.query('select * from public.route_stops where trip_id=$1',[trip])).rows).toHaveLength(2);
 expect((await db.query('select * from public.extra_visit_events')).rows).toHaveLength(3);
});
it('rechaza fecha distinta sin agregar paradas ni cambiar la solicitud',async()=>{
 const trip=await assigned(),v=await extraVisit();await db.exec('reset role');await db.query("update public.inventory_trips set service_date=current_date+1 where id=$1",[trip]);await actor(owner);
 await denied(()=>db.query("select public.owner_manage_extra_visit($1,$2,$3,'assigned',$4)",[tenant,crypto.randomUUID(),v.id,trip]),/fecha solicitada/);
 expect((await db.query('select * from public.extra_visit_requests')).rows[0].state).toBe('pending');
});
it('cambio mantiene contrato y alquiler, con reintento sin duplicados',async()=>{
 const v=await dispenserContract(),before=(await db.query('select * from public.dispenser_assignments')).rows[0];
 await db.query('select public.commerce_charge_rental($1,$2,$3,null,0,current_date-9)',[tenant,crypto.randomUUID(),v.assignment]);
 const ids=await exchange(v);await exchange(v,ids);
 const after=(await db.query('select * from public.dispenser_assignments')).rows[0];
 expect(after.id).toBe(before.id);expect(after.product_id).toBe(v.replacement);expect(after.monthly).toBe(before.monthly);expect(after.occurred_on).toEqual(before.occurred_on);expect(after.status).toBe('active');
 expect((await db.query('select * from public.dispenser_exchanges')).rows).toHaveLength(1);
 expect((await db.query('select * from public.inventory_owned_stock where product_id=$1',[v.old])).rows[0].depot_ready).toBe(1);
 await denied(()=>db.query('select public.commerce_charge_rental($1,$2,$3,null,0,current_date)',[tenant,crypto.randomUUID(),v.assignment]),/periodo|período/);
});
it('no usa la unidad retirada como su propio reemplazo ni deja retiro parcial',async()=>{
 const v=await dispenserContract();const before=(await db.query('select count(*) as n from public.inventory_operations')).rows[0].n;
 await denied(()=>exchange({...v,replacement:v.old}),/No hay reemplazo/);
 expect((await db.query('select count(*) as n from public.inventory_operations')).rows[0].n).toBe(before);
 expect((await db.query('select * from public.dispenser_assignments')).rows[0].product_id).toBe(v.old);
});
it('retirado roto sale del inventario activo y conserva responsable e historial',async()=>{
 const v=await dispenserContract();await exchange(v,{state:'broken'});
 const history=(await db.query('select * from public.dispenser_exchanges')).rows[0];expect(history.involved_kind).toBe('customer');expect(history.involved_id).toBe(v.customer);
 const old=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[v.old])).rows[0];expect(old.total_owned).toBe(0);expect(old.depot_ready).toBe(0);
 expect((await db.query('select * from public.dispenser_assignments')).rows[0].status).toBe('active');
});
it('cambio desde camion devuelve el anterior al camion, no al deposito',async()=>{
 const v=await dispenserContract(),trip=crypto.randomUUID();await db.query("select public.inventory_create_trip($1,$2,$3,'Camion',current_date,$4)",[tenant,trip,owner,[v.customer]]);
 await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),trip,JSON.stringify([{product_id:v.replacement,quantity:1}])]);
 await exchange(v,{trip});const old=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[v.old])).rows[0];expect(old.depot_ready).toBe(0);expect(old.truck_ready).toBe(1);
});
it('no permite devolucion fechada antes del ultimo cambio',async()=>{
 const v=await dispenserContract();await exchange(v);
 await denied(()=>db.query('select public.inventory_return_dispenser_model($1,$2,$3,current_date-2)',[tenant,crypto.randomUUID(),v.assignment]),/fecha es anterior/);
});
it('otro jefe y asistente no pueden cambiar ni leer historial de dispenser',async()=>{
 const v=await dispenserContract();await exchange(v);await actor(driver);await denied(()=>exchange(v),/Solo el jefe/);expect((await db.query('select * from public.dispenser_exchanges')).rows).toHaveLength(0);
 await actor(otherOwner);await denied(()=>exchange(v),/Solo el jefe/);expect((await db.query('select * from public.dispenser_exchanges')).rows).toHaveLength(0);
});
