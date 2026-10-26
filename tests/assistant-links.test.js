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

async function costLoadFixture(){
 await actor(owner);const product=crypto.randomUUID(),trip=crypto.randomUUID(),id=crypto.randomUUID(),refill=crypto.randomUUID();
 const customer=(await db.query('select id from public.customers where tenant_id=$1 order by name limit 1',[tenant])).rows[0].id;
 await db.query("select public.inventory_create_product($1,$2,'Agua costo',100,'unidad',true)",[tenant,product]);
 await db.query("select public.inventory_record_stock($1,$2,'receive',null,null,$3,'',current_date)",[tenant,crypto.randomUUID(),JSON.stringify([{product_id:product,quantity:2}])]);
 await db.query("select public.inventory_record_stock($1,$2,'receive_empty',null,null,$3,'',current_date)",[tenant,crypto.randomUUID(),JSON.stringify([{product_id:product,quantity:10}])]);
 await db.query('insert into public.customer_product_preferences(tenant_id,customer_id,product_id,quantity) values($1,$2,$3,3)',[tenant,customer,product]);
 await db.query("select public.inventory_create_trip($1,$2,$3,'Carga costo',current_date,$4)",[tenant,trip,owner,[customer]]);
 await db.query('select public.owner_set_filling_costs($1,true,$2)',[tenant,JSON.stringify([{product_id:product,unit_cost:100}])]);
 return {product,trip,id,refill,customer};
}
async function confirmCostLoad(v,quantity=5,fill=true){return db.query("select public.inventory_confirm_load($1,$2,$3,$4,$5,current_date,$6,'Carga prueba')",[tenant,v.id,v.refill,v.trip,JSON.stringify([{product_id:v.product,quantity}]),fill]);}
it('costo historico cuenta solo faltante rellenado y conserva sugeridos extras y nombres',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);
 let snapshot=(await db.query('select * from public.inventory_load_snapshots')).rows[0];
 expect(Number(snapshot.filling_total)).toBe(300);expect(snapshot.items[0]).toMatchObject({suggested:3,loaded:5,extra:2,missing:0,refilled:3,unit_cost:100,filling_cost:300,name:'Agua costo'});
 await db.query('select public.owner_set_filling_costs($1,false,$2)',[tenant,JSON.stringify([{product_id:v.product,unit_cost:900}])]);
 await db.query("update public.products set name='Otro nombre' where id=$1",[v.product]);
 await db.query('update public.customer_product_preferences set quantity=50 where product_id=$1',[v.product]);
 await confirmCostLoad(v);snapshot=(await db.query('select * from public.inventory_load_snapshots')).rows[0];
 expect(Number(snapshot.filling_total)).toBe(300);expect(snapshot.items[0].name).toBe('Agua costo');expect(snapshot.items[0].suggested).toBe(3);
 expect((await db.query('select * from public.inventory_load_snapshots')).rows).toHaveLength(1);
 await denied(()=>confirmCostLoad(v,6),/otros datos/);
});
it('carga de llenos no cobra llenado y registra faltantes de sugerencia',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v,2,false);
 const s=(await db.query('select * from public.inventory_load_snapshots')).rows[0];
 expect(Number(s.filling_total)).toBe(0);expect(s.items[0]).toMatchObject({suggested:3,loaded:2,missing:1,extra:0,refilled:0});
});
it('control desactivado no atribuye costos retroactivos y fallo no deja relleno ni snapshot',async()=>{
 const v=await costLoadFixture();const before=(await db.query('select count(*) n from public.inventory_operations')).rows[0].n;
 await denied(()=>confirmCostLoad(v,20),/suficientes/);
 expect((await db.query('select count(*) n from public.inventory_operations')).rows[0].n).toBe(before);
 expect((await db.query('select * from public.inventory_load_snapshots')).rows).toHaveLength(0);
 await db.query("select public.owner_set_filling_costs($1,false,'[]')",[tenant]);await confirmCostLoad(v);
 const s=(await db.query('select * from public.inventory_load_snapshots')).rows[0];expect(s.cost_enabled).toBe(false);expect(Number(s.filling_total)).toBe(0);expect(s.items[0].unit_cost).toBe(null);
});
it('snapshot usa pedido extraordinario en lugar del habitual',async()=>{
 const v=await costLoadFixture(),request=crypto.randomUUID();
 await db.query("select public.owner_request_extra_visit($1,$2,$3,current_date,$4,'')",[tenant,request,v.customer,JSON.stringify([{product_id:v.product,quantity:4}])]);
 await db.query("select public.owner_manage_extra_visit($1,$2,$3,'assigned',$4)",[tenant,crypto.randomUUID(),request,v.trip]);
 await confirmCostLoad(v);expect((await db.query('select items from public.inventory_load_snapshots')).rows[0].items[0]).toMatchObject({suggested:4,loaded:5,extra:1});
});
it('costos y snapshots solo jefe de la empresa sin escritura directa',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);
 await actor(otherOwner);expect((await db.query('select * from public.inventory_load_snapshots')).rows).toHaveLength(0);expect((await db.query('select * from public.filling_cost_settings')).rows).toHaveLength(0);
 await denied(()=>db.query("select public.owner_set_filling_costs($1,true,'[]')",[tenant]),/Solo el jefe/);
 await actor(driver);await denied(()=>confirmCostLoad(v),/Solo el jefe/);
 await actor(owner);await denied(()=>db.query('update public.inventory_load_snapshots set filling_total=0'),/permission denied/);
 await denied(()=>db.query('select public.owner_set_filling_costs($1,true,$2)',[tenant,JSON.stringify([{product_id:v.product,unit_cost:-1}])]),/Costo o producto/);
});

it('apertura del asistente incluye solo stock de su camion aceptado sin deposito ni precios',async()=>{
 const trip=await assigned();await actor(driver);await answer(trip);await actor(owner);
 const product=crypto.randomUUID(),otherTrip=crypto.randomUUID();
 await db.query("select public.inventory_create_product($1,$2,'Agua camion',100,'unidad',true)",[tenant,product]);
 const line=q=>JSON.stringify([{product_id:product,quantity:q}]);
 await db.query("select public.inventory_post($1,$2,'receive',null,null,$3,'')",[tenant,crypto.randomUUID(),line(10)]);
 await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),trip,line(3)]);
 const customer=(await db.query('select id from public.customers where tenant_id=$1',[tenant])).rows[0].id;
 await db.query("select public.inventory_create_trip($1,$2,$3,'Otro camion',current_date,$4)",[tenant,otherTrip,owner,[customer]]);
 await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),otherTrip,line(2)]);
 await actor(driver);const result=(await preview(trip)).rows[0].result;
 expect(result.stock).toHaveLength(1);expect(result.stock[0]).toMatchObject({product_id:product,loaded:3,ready:3,empties:0});
 expect(result.stock[0]).not.toHaveProperty('depot_ready');expect(result.stock[0]).not.toHaveProperty('unit_price');
 expect((await db.query('select * from public.inventory_movements')).rows).toHaveLength(0);
 await denied(()=>preview(otherTrip),/Reparto no aceptado/);
});

async function deliveryFixture(){
 const trip=await assigned();await actor(driver);await answer(trip);await actor(owner);const product=crypto.randomUUID();
 const customer=(await db.query('select id from public.customers where tenant_id=$1',[tenant])).rows[0].id;
 await db.query("select public.inventory_create_product($1,$2,'Agua visita',100,'unidad',true)",[tenant,product]);
 await db.query("select public.inventory_record_stock($1,$2,'receive',null,null,$3,'',current_date)",[tenant,crypto.randomUUID(),JSON.stringify([{product_id:product,quantity:10}])]);
 await db.query("select public.inventory_record_stock($1,$2,'opening_customer',null,$3,$4,'',current_date)",[tenant,crypto.randomUUID(),customer,JSON.stringify([{product_id:product,quantity:2}])]);
 await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),trip,JSON.stringify([{product_id:product,quantity:5}])]);
 await actor(driver);return {trip,product,customer,id:crypto.randomUUID()};
}
async function visitDetail(v){return (await db.query('select public.assistant_customer_visit($1,$2,$3) as d',[tenant,v.trip,v.customer])).rows[0].d;}
async function deliverVisit(v,{q=2,r=1,paid=100,total=200,version=1,id=v.id,method=paid>0?'cash':null,items=null}={}){return (await db.query("select public.assistant_deliver($1,$2,$3,$4,$5,$6,$7,$8,$9,'Visita de prueba') as result",[tenant,id,v.trip,v.customer,version,items??JSON.stringify([{product_id:v.product,quantity:q,returned:r}]),total,paid,method])).rows[0].result;}
it('entrega parcial atomica actualiza envases camion cobro y aviso sin duplicar al reintentar',async()=>{
 const v=await deliveryFixture(),before=await visitDetail(v);expect(before.products[0]).toMatchObject({held:2,ready:5,price:100});
 const receipt=await deliverVisit(v);expect(receipt).toMatchObject({total:200,paid:100,remaining:100,credit_status:'pending',version:2});expect(await deliverVisit(v)).toEqual(receipt);
 const detail=await visitDetail(v);expect(detail.products[0]).toMatchObject({held:3,ready:3});expect(detail.balance).toBe(100);expect(detail.outcome).toBe('delivered');
 expect((await preview(v.trip)).rows[0].result.stock[0].empties).toBe(1);
 expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
 await actor(owner);expect((await db.query('select * from public.payments')).rows).toHaveLength(1);expect((await db.query('select * from public.owner_notifications')).rows).toHaveLength(2);
 expect((await db.query('select public.owner_credit_inbox($1) as inbox',[tenant])).rows[0].inbox).toMatchObject({count:1,items:[{customer:'Cliente A',balance:100}]});
 await db.query("select public.commerce_review_credit($1,$2,false,'Cobrar pendiente')",[tenant,v.id]);
 await actor(driver);expect((await visitDetail(v)).balance).toBe(100);
 await denied(()=>deliverVisit(v,{id:crypto.randomUUID()}),/parada cambio/);
});
it('pago completo no pide credito y retorno sin entrega conserva el envase restante',async()=>{
 const v=await deliveryFixture();const result=await deliverVisit(v,{q:0,r:1,total:0,paid:0});expect(result).toMatchObject({total:0,remaining:0,credit_status:'paid'});
 expect((await visitDetail(v)).products[0].held).toBe(1);
 await actor(owner);expect((await db.query('select * from public.credit_requests')).rows).toHaveLength(0);expect((await db.query('select * from public.payments')).rows).toHaveLength(0);
});
it('total pagado en transferencia crea un pago y ningun pedido de deuda',async()=>{
 const v=await deliveryFixture();await deliverVisit(v,{paid:200,method:'transfer'});await actor(owner);
 expect((await db.query('select * from public.credit_requests')).rows).toHaveLength(0);expect((await db.query('select method,amount from public.payments')).rows[0]).toMatchObject({method:'transfer',amount:'200.00'});
});
it('rechazo por stock retorno excesivo version precio o sobrepago no deja movimientos parciales',async()=>{
 const v=await deliveryFixture();
 await denied(()=>deliverVisit(v,{q:6,total:600}),/Stock insuficiente/);
 await denied(()=>deliverVisit(v,{r:5}),/mas envases/);
 await denied(()=>deliverVisit(v,{version:99}),/parada cambio/);
 await denied(()=>deliverVisit(v,{total:201}),/precio cambio/);
 await denied(()=>deliverVisit(v,{paid:201}),/cobro supera/);
 await denied(()=>deliverVisit(v,{items:JSON.stringify([{product_id:v.product,quantity:1},{product_id:v.product,quantity:1}])}),/repetido/);
 await actor(owner);expect((await db.query("select * from public.inventory_operations where kind='delivery'")).rows).toHaveLength(0);expect((await db.query('select * from public.sales')).rows).toHaveLength(0);expect((await db.query('select * from public.owner_notifications')).rows).toHaveLength(0);
});
it('futura baja permite solo recuperar y no entrega de productos',async()=>{
 const v=await deliveryFixture();await actor(owner);await db.query('update public.customers set pending_recovery=true where tenant_id=$1 and id=$2',[tenant,v.customer]);await actor(driver);
 await denied(()=>deliverVisit(v),/futura baja/);await deliverVisit(v,{q:0,r:1,total:0,paid:0});expect((await visitDetail(v)).products[0].held).toBe(1);
});
it('revocacion bloqueo o destinatario distinto impiden planilla y escritura incluso reintento',async()=>{
 const v=await deliveryFixture();await actor(second);await denied(()=>deliverVisit(v),/Reparto no aceptado/);await denied(()=>visitDetail(v),/Reparto no aceptado/);
 await actor(driver);await deliverVisit(v);await actor(owner);await db.query('select public.owner_revoke_trip_invitation($1,$2,$3)',[tenant,v.trip,crypto.randomUUID()]);await actor(driver);await denied(()=>deliverVisit(v),/Reparto no aceptado/);
 await denied(()=>db.query('select public.owner_credit_inbox($1)',[tenant]),/Solo el jefe/);
 await actor(otherOwner);await denied(()=>db.query('select public.owner_credit_inbox($1)',[tenant]),/Solo el jefe/);
});
it('idempotencia rechaza cambiar el cobro o la entrega de una operacion confirmada',async()=>{
 const v=await deliveryFixture();await deliverVisit(v);await denied(()=>deliverVisit(v,{paid:200}),/otros datos/);await denied(()=>deliverVisit(v,{q:1,total:100}),/otros datos/);
});

async function recordAssistantVisit(v,{id=crypto.randomUUID(),version=1,outcome='absent',followup='later_today',offset=0}={}){
 return (await db.query("select public.assistant_record_visit($1,$2,$3,$4,$5,$6,$7,case when $7::text is null then null else (now() at time zone 'America/Argentina/Buenos_Aires')::date+$8::integer end,'Visita pendiente') as result",[tenant,id,v.trip,v.customer,version,outcome,followup,offset])).rows[0].result;
}
async function collectAssistantDebt(v,{id=crypto.randomUUID(),sale=v.id,expected=100,amount=40,method='cash'}={}){return (await db.query("select public.assistant_collect_debt($1,$2,$3,$4,$5,$6,$7,$8,'Cobro anterior') as result",[tenant,id,v.trip,v.customer,sale,expected,amount,method])).rows[0].result;}
async function customerDebts(v){return (await db.query('select public.assistant_customer_debts($1,$2,$3) as result',[tenant,v.trip,v.customer])).rows[0].result;}
it('ausencia mas tarde se conserva sin stock ni cargo y permite atender despues con version actualizada',async()=>{
 const v=await deliveryFixture(),id=crypto.randomUUID();const receipt=await recordAssistantVisit(v,{id});expect(receipt).toMatchObject({id,version:2,outcome:'absent'});expect(await recordAssistantVisit(v,{id})).toEqual(receipt);
 const trip=(await preview(v.trip)).rows[0].result;expect(trip.stops[0]).toMatchObject({outcome:'absent',followup:'later_today'});expect(trip.stock[0].ready).toBe(5);
 await denied(()=>recordAssistantVisit(v,{version:1}),/parada cambio/);
 await deliverVisit(v,{version:2});expect((await preview(v.trip)).rows[0].result.stops[0]).toMatchObject({outcome:'delivered',followup:null,next_date:null});
});
it('otro dia requiere fecha futura y no compro cierra sin mover stock ni crear venta',async()=>{
 const v=await deliveryFixture();await denied(()=>recordAssistantVisit(v,{followup:'date',offset:0}),/otro dia futuro/);
 await recordAssistantVisit(v,{followup:'date',offset:7});expect((await preview(v.trip)).rows[0].result.stops[0].followup).toBe('date');
 await recordAssistantVisit(v,{version:2,outcome:'no_purchase',followup:null});await denied(()=>recordAssistantVisit(v,{version:3}),/parada cambio/);
 await actor(owner);expect((await db.query("select * from public.inventory_operations where kind='delivery'")).rows).toHaveLength(0);expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
});
it('cobro anterior parcial es idempotente y no genera venta ni movimiento de stock',async()=>{
 const v=await deliveryFixture();await deliverVisit(v);const before=(await preview(v.trip)).rows[0].result.stock[0];const payment=crypto.randomUUID();
 const list=await customerDebts(v);expect(list).toMatchObject({count:1,balance:100,items:[{id:v.id,balance:100}]});
 const result=await collectAssistantDebt(v,{id:payment});expect(result).toMatchObject({id:payment,amount:40,remaining:60});expect(await collectAssistantDebt(v,{id:payment})).toEqual(result);
 expect((await preview(v.trip)).rows[0].result.stock[0]).toEqual(before);expect((await customerDebts(v)).balance).toBe(60);
 await actor(owner);expect((await db.query('select * from public.sales')).rows).toHaveLength(1);expect((await db.query('select * from public.payments')).rows).toHaveLength(2);
 expect((await db.query('select trip_id from public.payments where id=$1',[payment])).rows[0].trip_id).toBe(v.trip);
});
it('saldo cambiado y sobrepago se rechazan sin duplicar cobros; pago completo resuelve credito pendiente',async()=>{
 const v=await deliveryFixture();await deliverVisit(v);await collectAssistantDebt(v);
 await denied(()=>collectAssistantDebt(v,{expected:100}),/saldo cambio/);await denied(()=>collectAssistantDebt(v,{expected:60,amount:61}),/supera el saldo/);
 await collectAssistantDebt(v,{expected:60,amount:60,method:'transfer'});expect((await customerDebts(v)).count).toBe(0);
 await actor(owner);expect((await db.query('select status from public.credit_requests')).rows[0].status).toBe('settled');
});
it('deuda rechazada sigue cobrable y no convierte el pago en nueva venta',async()=>{
 const v=await deliveryFixture();await deliverVisit(v);await actor(owner);await db.query("select public.commerce_review_credit($1,$2,false,'Cobrar')",[tenant,v.id]);await actor(driver);
 expect((await customerDebts(v)).items[0].credit_status).toBe('rejected');await collectAssistantDebt(v,{amount:100});expect((await customerDebts(v)).balance).toBe(0);
});
it('cobra apertura anterior de cliente asignado incluso en futura baja sin entregar productos',async()=>{
 const v=await deliveryFixture(),sale=crypto.randomUUID();await actor(owner);await db.query("select public.commerce_open_customer_balance($1,$2,$3,250,current_date-1,'Anterior al sistema')",[tenant,sale,v.customer]);
 await db.query('update public.customers set pending_recovery=true where tenant_id=$1 and id=$2',[tenant,v.customer]);await actor(driver);
 expect((await customerDebts(v)).items[0]).toMatchObject({kind:'opening',balance:250});await collectAssistantDebt(v,{sale,expected:250,amount:250});
 expect((await preview(v.trip)).rows[0].result.stock[0].ready).toBe(5);expect((await customerDebts(v)).count).toBe(0);
});
it('revocacion y otra cuenta bloquean visitas cargos y cobros incluso reintentos',async()=>{
 const v=await deliveryFixture(),visit=crypto.randomUUID();await recordAssistantVisit(v,{id:visit});await actor(second);
 await denied(()=>recordAssistantVisit(v),/Reparto no aceptado/);await denied(()=>customerDebts(v),/Reparto no aceptado/);await denied(()=>collectAssistantDebt(v),/Reparto no aceptado/);
 await actor(owner);await db.query('select public.owner_revoke_trip_invitation($1,$2,$3)',[tenant,v.trip,crypto.randomUUID()]);await actor(driver);await denied(()=>recordAssistantVisit(v,{id:visit}),/Reparto no aceptado/);
});
it('cobro no permite cargo de otro cliente y reintento no admite otro importe',async()=>{
 const v=await deliveryFixture();await deliverVisit(v);const id=crypto.randomUUID();await collectAssistantDebt(v,{id});await denied(()=>collectAssistantDebt(v,{id,amount:50}),/otros datos/);
 await denied(()=>collectAssistantDebt(v,{sale:crypto.randomUUID()}),/Cargo no accesible/);
});

async function pendingOwnerFixture(){const v=await deliveryFixture();await recordAssistantVisit(v);await actor(owner);const target=crypto.randomUUID();await db.query("select public.inventory_create_trip($1,$2,$3,'Ruta destino',current_date,$4)",[tenant,target,owner,[v.customer]]);return {...v,target,command:crypto.randomUUID(),sourceEvent:crypto.randomUUID(),targetEvent:crypto.randomUUID()};}
async function manageFollowup(v,{action='assign',target=v.target,note='Reprogramado',version=2}={}){return (await db.query('select public.owner_manage_followup($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result',[tenant,v.command,v.sourceEvent,v.targetEvent,v.trip,v.customer,version,action,target,note])).rows[0].result;}
it('bandeja traslada pendiente sin duplicar parada ni cambiar inventario y reintento es estable',async()=>{
 const v=await pendingOwnerFixture();expect((await db.query('select public.owner_followup_inbox($1) as inbox',[tenant])).rows[0].inbox.count).toBe(1);
 const before=(await db.query('select count(*) n from public.inventory_operations')).rows[0].n;const result=await manageFollowup(v);expect(await manageFollowup(v)).toEqual(result);
 expect((await db.query('select public.owner_followup_inbox($1) as inbox',[tenant])).rows[0].inbox.count).toBe(0);
 const source=(await db.query('select active,outcome,next_date,version from public.route_stops where tenant_id=$1 and trip_id=$2',[tenant,v.trip])).rows[0];expect(source).toMatchObject({active:false,outcome:'absent',version:3});expect(source.next_date).toBeTruthy();
 expect((await db.query('select * from public.route_stops where trip_id=$1',[v.target])).rows).toHaveLength(1);expect((await db.query('select count(*) n from public.inventory_operations')).rows[0].n).toBe(before);
 await denied(()=>manageFollowup(v,{note:'Otra nota'}),/otros datos/);
});
it('bandeja acepta origen cerrado y exige motivo al resolver conservando la ausencia',async()=>{
 const v=await pendingOwnerFixture();await db.exec(`reset role; update public.inventory_trips set status='closed',submitted_at=now(),closed_at=now() where id='${v.trip}'`);await actor(owner);
 expect((await db.query('select public.owner_followup_inbox($1) as inbox',[tenant])).rows[0].inbox.items[0].trip_status).toBe('closed');
 await denied(()=>manageFollowup(v,{action:'resolve',target:null,note:''}),/motivo invalido/);await manageFollowup(v,{action:'resolve',target:null,note:'Ya fue atendido'});
 expect((await db.query("select * from public.route_events where trip_id=$1 and action='absent'",[v.trip])).rows).toHaveLength(1);
});
it('destino temprano o ya resuelto revierte traslado y mantiene origen pendiente',async()=>{
 const v=await pendingOwnerFixture();await db.exec('reset role');await db.query('update public.inventory_trips set service_date=current_date-1 where id=$1',[v.target]);await actor(owner);await denied(()=>manageFollowup(v),/otro reparto abierto/);
 await db.exec('reset role');await db.query('update public.inventory_trips set service_date=current_date where id=$1',[v.target]);await db.exec(`reset role; update public.route_stops set outcome='no_purchase' where trip_id='${v.target}'`);await actor(owner);await denied(()=>manageFollowup(v),/otro resultado/);
 expect((await db.query('select active from public.route_stops where trip_id=$1',[v.trip])).rows[0].active).toBe(true);expect((await db.query('select * from public.followup_resolutions')).rows).toHaveLength(0);
});
it('solo jefe de la empresa lee y resuelve pendientes',async()=>{
 const v=await pendingOwnerFixture();await actor(driver);await denied(()=>db.query('select public.owner_followup_inbox($1)',[tenant]),/Solo el jefe/);await denied(()=>manageFollowup(v),/Solo el jefe/);await actor(otherOwner);await denied(()=>manageFollowup(v),/Solo el jefe/);expect((await db.query('select * from public.followup_resolutions')).rows).toHaveLength(0);
});

async function customerProposalFixture(){const v=await deliveryFixture();const request=crypto.randomUUID();await db.query("select public.assistant_propose_customer($1,$2,$3,'Nuevo cliente','Direccion nueva','111','Localidad',-34.6,-58.4)",[tenant,request,v.trip]);return {...v,request,decision:crypto.randomUUID(),event:crypto.randomUUID()};}
async function reviewCustomer(v,{approve=true,trip=v.trip,note='',event=v.event}={}){return db.query('select public.owner_review_customer_proposal($1,$2,$3,$4,$5,$6,$7)',[tenant,v.decision,v.request,event,approve,trip,note]);}
it('solicitud no crea cliente ni stock hasta aprobar y reintentos no duplican',async()=>{
 const v=await customerProposalFixture();await db.query("select public.assistant_propose_customer($1,$2,$3,'Nuevo cliente','Direccion nueva','111','Localidad',-34.6,-58.4)",[tenant,v.request,v.trip]);
 expect((await db.query('select public.customer_proposal_inbox($1,$2) as inbox',[tenant,v.trip])).rows[0].inbox.count).toBe(1);await actor(owner);
 expect((await db.query('select * from public.customers where id=$1',[v.request])).rows).toHaveLength(0);const before=(await db.query('select count(*) n from public.inventory_operations')).rows[0].n;
 await reviewCustomer(v);await reviewCustomer(v);
 expect((await db.query('select * from public.customers where id=$1',[v.request])).rows).toHaveLength(1);expect((await db.query('select * from public.route_stops where customer_id=$1',[v.request])).rows).toHaveLength(1);expect((await db.query('select count(*) n from public.inventory_operations')).rows[0].n).toBe(before);
 await actor(driver);expect((await preview(v.trip)).rows[0].result.stops.some(s=>s.id===v.request)).toBe(true);await actor(owner);await denied(()=>reviewCustomer(v,{event:crypto.randomUUID()}),/ya resuelta/);
});
it('rechazo requiere motivo y no crea cliente ni parada',async()=>{
 const v=await customerProposalFixture();await actor(owner);await denied(()=>reviewCustomer(v,{approve:false,trip:null}),/motivo invalido/);await reviewCustomer(v,{approve:false,trip:null,note:'Ya es cliente'});await reviewCustomer(v,{approve:false,trip:null,note:'Ya es cliente'});
 expect((await db.query('select * from public.customers where id=$1',[v.request])).rows).toHaveLength(0);await actor(driver);expect((await db.query('select public.customer_proposal_inbox($1,$2) as inbox',[tenant,v.trip])).rows[0].inbox.items[0]).toMatchObject({status:'rejected',decision_note:'Ya es cliente'});
});
it('destino cerrado o cliente duplicado rechaza aprobacion sin alta parcial',async()=>{
 const v=await customerProposalFixture();await db.exec(`reset role; update public.inventory_trips set status='closed',submitted_at=now(),closed_at=now() where id='${v.trip}'`);await actor(owner);await denied(()=>reviewCustomer(v),/reparto preparado/);expect((await db.query('select * from public.customers where id=$1',[v.request])).rows).toHaveLength(0);
 const otherTrip=crypto.randomUUID();await db.query("select public.inventory_create_trip($1,$2,$3,'Otro reparto',current_date,$4)",[tenant,otherTrip,owner,[v.customer]]);await db.query("insert into public.customers(tenant_id,name,address) values($1,'Nuevo cliente','Direccion nueva')",[tenant]);await denied(()=>reviewCustomer(v,{trip:otherTrip}),/Ya existe un cliente/);
 expect((await db.query('select status from public.customer_proposals where id=$1',[v.request])).rows[0].status).toBe('pending');
});
it('sin recorrido aceptado ni jefe propio no se puede crear leer o aprobar solicitudes',async()=>{
 const v=await customerProposalFixture();await actor(second);await denied(()=>db.query('select public.customer_proposal_inbox($1,$2)',[tenant,v.trip]),/no accesibles/);await actor(otherOwner);await denied(()=>reviewCustomer(v),/Solo el jefe/);await actor(driver);await denied(()=>reviewCustomer(v),/Solo el jefe/);
 await actor(owner);await db.query('select public.owner_revoke_trip_invitation($1,$2,$3)',[tenant,v.trip,crypto.randomUUID()]);await actor(driver);await denied(()=>db.query("select public.assistant_propose_customer($1,$2,$3,'X','Y','','')",[tenant,crypto.randomUUID(),v.trip]),/Reparto no aceptado/);
});
it('coordenadas incompletas y solicitud pendiente repetida se rechazan',async()=>{
 const v=await customerProposalFixture();await denied(()=>db.query("select public.assistant_propose_customer($1,$2,$3,'Otro','Otro','','',1,null)",[tenant,crypto.randomUUID(),v.trip]),/Coordenadas invalidas/);await denied(()=>db.query("select public.assistant_propose_customer($1,$2,$3,'Nuevo cliente','Direccion nueva','','')",[tenant,crypto.randomUUID(),v.trip]),/Ya enviaste/);
});

it('jefe abre y atiende reparto propio sin invitacion y deuda se aprueba sin autoaviso',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);const visit={...v,id:crypto.randomUUID()};
 expect((await db.query('select public.owner_my_trips($1) as trips',[tenant])).rows[0].trips[0].id).toBe(v.trip);expect((await db.query('select public.owner_trip_invitations($1) as items',[tenant])).rows[0].items).toHaveLength(0);
 expect((await preview(v.trip)).rows[0].result.trip.status).toBe('active');expect((await visitDetail(v)).customer.id).toBe(v.customer);
 const receipt=await deliverVisit(visit,{r:0});expect(receipt.credit_status).toBe('approved');expect(await deliverVisit(visit,{r:0})).toEqual(receipt);
 expect((await db.query('select status,decided_by from public.credit_requests')).rows[0]).toMatchObject({status:'approved',decided_by:owner});expect((await db.query('select * from public.owner_notifications')).rows).toHaveLength(0);
 await collectAssistantDebt(visit,{amount:100});expect((await customerDebts(visit)).balance).toBe(0);
});
it('jefe registra ausencia en ruta propia y no abre operacion de una ruta ajena',async()=>{
 const own=await costLoadFixture();await confirmCostLoad(own);await recordAssistantVisit(own);expect((await preview(own.trip)).rows[0].result.stops[0].outcome).toBe('absent');
 const driverTrip=await assigned();await actor(owner);await denied(()=>preview(driverTrip),/Reparto no aceptado/);
});
it('suspender licencia o cerrar ruta propia retira acceso operativo del jefe',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);await db.exec(`reset role; update public.licenses set status='suspended' where tenant_id='${tenant}'`);await actor(owner);await denied(()=>visitDetail(v),/Reparto no aceptado/);
 await db.exec(`reset role; update public.licenses set status='active' where tenant_id='${tenant}'; update public.inventory_trips set status='closed',submitted_at=now(),closed_at=now() where id='${v.trip}'`);await actor(owner);await denied(()=>preview(v.trip),/Reparto no aceptado/);expect((await db.query('select public.owner_my_trips($1) as trips',[tenant])).rows[0].trips).toHaveLength(0);
});

async function ownerCloseQuote(v){return (await db.query('select public.owner_preview_trip_close($1,$2) as result',[tenant,v.trip])).rows[0].result;}
async function finishOwner(v,quote,{id=crypto.randomUUID(),cash=quote.cash,transfer=quote.transfer,stock=quote.stock.map(p=>({product_id:p.product_id,ready:p.ready,empties:p.empties}))}={}){return (await db.query("select public.owner_finish_self_trip($1,$2,$3,$4,$5,$6,$7,'Conteo revisado') as result",[tenant,id,v.trip,JSON.stringify(quote),cash,transfer,JSON.stringify(stock)])).rows[0].result;}
it('cierre propio devuelve stock y permite siguiente carga sin duplicar caja ni historial',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);const opening=crypto.randomUUID();
 await db.query("select public.commerce_open_customer_balance($1,$2,$3,50,current_date-1,'Saldo anterior')",[tenant,opening,v.customer]);await collectAssistantDebt({...v,id:opening},{expected:50,amount:50});
 const visit={...v,id:crypto.randomUUID()};await deliverVisit(visit,{r:0});await collectAssistantDebt(visit,{amount:100,method:'transfer'});
 await db.query('select public.route_publish_position($1,$2,1,1,5)',[tenant,v.trip]);const quote=await ownerCloseQuote(v);expect(quote).toMatchObject({cash:150,transfer:100,sales:200,pending_visits:0});
 const id=crypto.randomUUID(),receipt=await finishOwner(v,quote,{id});expect(receipt.trip.status).toBe('closed');expect(await finishOwner(v,quote,{id})).toEqual(receipt);
 expect((await db.query("select * from public.inventory_operations where kind='close'")).rows).toHaveLength(1);expect((await db.query('select * from public.payments')).rows).toHaveLength(3);expect((await db.query('select * from public.driver_positions')).rows).toHaveLength(1);
 const stock=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[v.product])).rows[0];expect(Number(stock.depot_ready)).toBe(3);expect(Number(stock.truck_ready)).toBe(0);
 await db.query("update public.products set name='Nuevo nombre' where id=$1",[v.product]);expect((await db.query('select public.owner_self_close_history($1) as history',[tenant])).rows[0].history[0].stock[0].name).toBe('Agua costo');
 const next=crypto.randomUUID();await db.query("select public.inventory_create_trip($1,$2,$3,'Otra salida',current_date,$4)",[tenant,next,owner,[v.customer]]);await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),next,JSON.stringify([{product_id:v.product,quantity:1}])]);
});
it('cierre exige resultado de paradas y conserva ausencias en bandeja global tras cerrar',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);const quote=await ownerCloseQuote(v);await denied(()=>finishOwner(v,quote),/clientes sin resultado/);
 expect((await db.query('select status from public.inventory_trips where id=$1',[v.trip])).rows[0].status).toBe('active');await recordAssistantVisit(v);await finishOwner(v,await ownerCloseQuote(v));expect((await db.query('select public.owner_followup_inbox($1) as inbox',[tenant])).rows[0].inbox.count).toBe(1);
});
it('diferencias y resumen obsoleto no dejan rendicion parcial',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);await recordAssistantVisit(v,{outcome:'no_purchase',followup:null});const quote=await ownerCloseQuote(v);
 await denied(()=>finishOwner(v,quote,{cash:1}),/conteo no coincide/);await denied(()=>finishOwner(v,quote,{stock:[{product_id:v.product,ready:4,empties:0}]}),/conteo no coincide/);
 const opening=crypto.randomUUID();await db.query("select public.commerce_open_customer_balance($1,$2,$3,50,current_date-1,'Saldo anterior')",[tenant,opening,v.customer]);await collectAssistantDebt({...v,id:opening},{expected:50,amount:50});await denied(()=>finishOwner(v,quote),/reparto cambio/);
 expect((await db.query('select * from public.trip_closures')).rows).toHaveLength(0);expect((await db.query('select status from public.inventory_trips where id=$1',[v.trip])).rows[0].status).toBe('active');
});
it('solo titular asignado cierra su ruta y puede recuperar estado submitted antiguo',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);await recordAssistantVisit(v,{outcome:'no_purchase',followup:null});const quote=await ownerCloseQuote(v);
 await actor(otherOwner);await denied(()=>finishOwner(v,quote),/Solo el jefe asignado/);await actor(driver);await denied(()=>ownerCloseQuote(v),/Solo el jefe asignado/);await actor(owner);
 await db.query('select public.inventory_submit_trip($1,$2)',[tenant,v.trip]);await finishOwner(v,await ownerCloseQuote(v));await denied(()=>db.query("insert into public.owner_trip_close_snapshots(tenant_id,id,trip_id,actor_id,request,snapshot) values($1,$2,$3,$4,'{}','{}')",[tenant,crypto.randomUUID(),v.trip,owner]),/permission denied/);
});

it('alta de jefe verificado crea empresa propia con prueba basica de treinta dias una sola vez',async()=>{
 await actor(driver);const status=(await db.query('select public.owner_signup_status() as status')).rows[0].status;expect(status).toMatchObject({state:'new',mode:'trial',days:30,driver_limit:1});
 const tenantId=(await db.query("select public.owner_create_workspace('Empresa nueva') as id")).rows[0].id;expect((await db.query("select public.owner_create_workspace('Otro nombre') as id")).rows[0].id).toBe(tenantId);
 expect((await db.query('select public.owner_signup_status() as status')).rows[0].status).toMatchObject({state:'ready',tenant_id:tenantId});
 const license=(await db.query("select kind,status,driver_plan,driver_limit,expires_at>now()+interval '29 days' and expires_at<=now()+interval '30 days' as correct_days from public.licenses where tenant_id=$1",[tenantId])).rows[0];expect(license).toMatchObject({kind:'monthly',status:'active',driver_plan:'basic',driver_limit:1,correct_days:true});
 expect((await db.query('select public.is_platform_admin() as admin')).rows[0].admin).toBe(false);
 await db.exec('reset role');expect((await db.query('select * from public.owner_registrations')).rows).toHaveLength(1);expect((await db.query('select kind,status from public.licenses where tenant_id=$1',[tenant])).rows[0]).toMatchObject({kind:'permanent',status:'active'});
});
it('metadatos no pueden elegir rol administrativo licencia permanente ni empresa ajena',async()=>{
 await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[JSON.stringify({signup_kind:'owner',role:'admin',tenant_id:tenant,license:'permanent',driver_limit:99}),driver]);await actor(driver);const target=(await db.query("select public.owner_create_workspace('Empresa propia') as id")).rows[0].id;expect(target).not.toBe(tenant);expect((await db.query('select kind,driver_limit from public.licenses where tenant_id=$1',[target])).rows[0]).toMatchObject({kind:'monthly',driver_limit:1});expect((await db.query('select * from public.tenant_members where tenant_id=$1',[tenant])).rows).toHaveLength(0);expect((await db.query('update public.owner_signup_policy set trial_days=90')).affectedRows).toBe(0);await db.exec('reset role');expect((await db.query('select trial_days from public.owner_signup_policy')).rows[0].trial_days).toBe(30);
});
it('no confirma empresa con correo sin verificar y no renueva prueba vencida al repetir',async()=>{
 await actor(unconfirmed);await denied(()=>db.query("select public.owner_create_workspace('Sin verificar')"),/Confirma tu correo/);await actor(second);const target=(await db.query("select public.owner_create_workspace('Empresa de prueba') as id")).rows[0].id;
 await db.exec('reset role');await db.query("update public.licenses set expires_at=now()-interval '1 day' where tenant_id=$1",[target]);await actor(second);await db.query("select public.owner_create_workspace('Nueva prueba')");await db.exec('reset role');expect((await db.query('select expires_at<now() as expired from public.licenses where tenant_id=$1',[target])).rows[0].expired).toBe(true);expect((await db.query('select count(*) n from public.owner_registrations where user_id=$1',[second])).rows[0].n).toBe(1);
});
it('registro administrativo existente se reutiliza sin alterar su licencia ni crear otra empresa',async()=>{
 await actor(owner);expect((await db.query("select public.owner_create_workspace('Empresa duplicada') as id")).rows[0].id).toBe(tenant);expect((await db.query('select public.owner_signup_status() as status')).rows[0].status.state).toBe('ready');await db.exec('reset role');expect((await db.query('select * from public.owner_registrations')).rows).toHaveLength(0);
});
it('modo aprobacion conserva espera y reconoce activacion sin restaurar una cuenta dada de baja',async()=>{
 await db.exec('update public.owner_signup_policy set auto_trial=false');await actor(driver);const target=(await db.query("select public.owner_create_workspace('Empresa en espera') as id")).rows[0].id;expect((await db.query('select public.owner_signup_status() as status')).rows[0].status.state).toBe('waiting');await db.exec('reset role');await db.query("update public.licenses set status='active' where tenant_id=$1",[target]);await actor(driver);expect((await db.query('select public.owner_signup_status() as status')).rows[0].status.state).toBe('ready');await db.exec('reset role');await db.query('update public.tenant_members set active=false where tenant_id=$1 and user_id=$2',[target,driver]);await actor(driver);expect((await db.query('select public.owner_signup_status() as status')).rows[0].status.state).toBe('blocked');expect((await db.query("select public.owner_create_workspace('Otra') as id")).rows[0].id).toBe(target);
});

async function initialLoadFixture(){
 const trip=await assigned();await actor(owner);const product=crypto.randomUUID(),equipment=crypto.randomUUID();
 await db.query("select public.inventory_create_product($1,$2,'Agua para carga',100,'unidad',true)",[tenant,product]);
 await db.query("select public.catalog_create_item($1,$2,'Dispenser basico',0,'unidad',false,'dispenser')",[tenant,equipment]);
 await db.query("select public.inventory_record_stock($1,$2,'receive',null,null,$3,'',current_date)",[tenant,crypto.randomUUID(),JSON.stringify([{product_id:product,quantity:2},{product_id:equipment,quantity:1}])]);
 await db.query("select public.inventory_record_stock($1,$2,'receive_empty',null,null,$3,'',current_date)",[tenant,crypto.randomUUID(),JSON.stringify([{product_id:product,quantity:10}])]);
 await db.query('select public.owner_set_filling_costs($1,true,$2)',[tenant,JSON.stringify([{product_id:product,unit_cost:5.25}])]);
 await db.exec('reset role');const customer=(await db.query('select id from public.customers where tenant_id=$1',[tenant])).rows[0].id;await db.query('insert into public.customer_product_preferences values($1,$2,$3,3)',[tenant,customer,product]);
 await actor(driver);await answer(trip);const date=(await db.query("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).rows[0].d;
 return {trip,product,equipment,date,id:crypto.randomUUID(),refill:crypto.randomUUID()};
}
async function confirmAssistantLoad(v,items=[{product_id:v.product,quantity:4}],fill=true){return db.query("select public.assistant_confirm_load($1,$2,$3,$4,$5,$6,$7,'Carga revisada') as id",[tenant,v.id,v.refill,v.trip,JSON.stringify(items),v.date,fill]);}
it('asistente aceptado carga una vez, rellena solo faltantes y conserva costo historico privado',async()=>{
 const v=await initialLoadFixture();const options=(await db.query('select public.assistant_load_options($1,$2) as data',[tenant,v.trip])).rows[0].data;
 expect(options.products.find(p=>p.id===v.product)).toMatchObject({ready:2,empties:10,suggested:3});expect(JSON.stringify(options)).not.toContain('unit_cost');expect(JSON.stringify(options)).not.toContain('price');
 await confirmAssistantLoad(v);await confirmAssistantLoad(v);await denied(()=>confirmAssistantLoad(v,[{product_id:v.product,quantity:5}]),/ID de carga/);await denied(()=>confirmAssistantLoad({...v,id:crypto.randomUUID(),refill:crypto.randomUUID()}),/Carga ya confirmada/);
 const open=(await preview(v.trip)).rows[0].result;expect(open.trip.status).toBe('active');expect(open.stock.find(p=>p.product_id===v.product)).toMatchObject({loaded:4,ready:4,empties:0});
 expect((await db.query('select * from public.inventory_load_snapshots')).rows).toHaveLength(0);
 await db.exec('reset role');const history=(await db.query('select * from public.inventory_load_snapshots where trip_id=$1',[v.trip])).rows[0];expect(Number(history.filling_total)).toBe(10.5);expect(history.items.find(p=>p.product_id===v.product)).toMatchObject({loaded:4,suggested:3,extra:1,refilled:2,unit_cost:5.25});
 expect((await db.query("select count(*)::int n from public.inventory_operations where trip_id=$1 and kind='load'",[v.trip])).rows[0].n).toBe(1);expect((await db.query('select sum(depot_ready)::int ready,sum(depot_empty)::int empties from public.inventory_movements where tenant_id=$1 and product_id=$2',[tenant,v.product])).rows[0]).toMatchObject({ready:0,empties:8});
});
it('carga requiere aceptacion y bloquea revocacion, licencia vencida, otro usuario y anonimos',async()=>{
 const v=await initialLoadFixture();await actor(second);await denied(()=>confirmAssistantLoad(v),/no aceptado/);await actor(owner);await denied(()=>confirmAssistantLoad(v),/no aceptado/);
 await db.exec('reset role');await db.query("update public.trip_invitations set state='pending' where trip_id=$1",[v.trip]);await actor(driver);await denied(()=>confirmAssistantLoad(v),/no aceptado/);await denied(()=>db.query('select public.assistant_load_options($1,$2)',[tenant,v.trip]),/no disponible/);
 await db.exec('reset role');await db.query("update public.trip_invitations set state='accepted' where trip_id=$1",[v.trip]);await db.query("update public.licenses set status='suspended' where tenant_id=$1",[tenant]);await actor(driver);await denied(()=>confirmAssistantLoad(v),/no aceptado/);
 await db.exec('reset role;set local role anon');await denied(()=>confirmAssistantLoad(v),/permission denied/);
});
it('stock insuficiente, duplicados, productos ajenos y parametros inventados no dejan carga parcial',async()=>{
 const v=await initialLoadFixture();
 for(const items of [[{product_id:v.product,quantity:4},{product_id:v.equipment,quantity:2}],[{product_id:v.product,quantity:1000}],[{product_id:v.product,quantity:1},{product_id:v.product,quantity:1}],[{product_id:crypto.randomUUID(),quantity:1}],[{product_id:v.product,quantity:1,unit_cost:0}],[{product_id:v.product,quantity:1.5}]])await denied(()=>confirmAssistantLoad(v,items),/Stock insuficiente|repetido|habilitado|invalida/);
 await denied(()=>confirmAssistantLoad(v,undefined,false),/Stock insuficiente/);await denied(()=>confirmAssistantLoad({...v,date:'2099-01-01'}),/fecha de hoy/);
 await db.exec('reset role');expect((await db.query('select * from public.inventory_load_snapshots where trip_id=$1',[v.trip])).rows).toHaveLength(0);expect((await db.query('select status from public.inventory_trips where id=$1',[v.trip])).rows[0].status).toBe('planned');expect((await db.query("select * from public.inventory_operations where kind='refill'",[])).rows).toHaveLength(0);
});
it('carga sin rellenado usa llenos, y no permite segunda salida antes de aprobar la anterior',async()=>{
 const v=await initialLoadFixture();await confirmAssistantLoad(v,[{product_id:v.product,quantity:1},{product_id:v.equipment,quantity:1}],false);
 const trip2=await assigned();await actor(driver);await answer(trip2);await denied(()=>confirmAssistantLoad({...v,trip:trip2,id:crypto.randomUUID(),refill:crypto.randomUUID()},[{product_id:v.product,quantity:1}],false),/reparto anterior/);
 await actor(owner);await denied(()=>db.query("select public.inventory_confirm_load($1,$2,$3,$4,$5,$6,false,'')",[tenant,crypto.randomUUID(),crypto.randomUUID(),v.trip,JSON.stringify([{product_id:v.product,quantity:1}]),v.date]),/Carga ya confirmada/);
 await db.exec('reset role');expect(Number((await db.query('select filling_total from public.inventory_load_snapshots where trip_id=$1',[v.trip])).rows[0].filling_total)).toBe(0);
});

async function assistantCloseQuote(v){return (await db.query('select public.assistant_preview_close($1,$2) as q',[tenant,v.trip])).rows[0].q;}
async function submitAssistantClose(v,q,{id=v.closeId??crypto.randomUUID(),cash=q.cash,transfer=q.transfer,stock=q.stock.map(p=>({product_id:p.product_id,ready:p.ready,empties:p.empties})),note='Conteo revisado'}={}){
 return (await db.query('select public.assistant_submit_close($1,$2,$3,$4,$5,$6,$7,$8) as result',[tenant,id,v.trip,JSON.stringify(q),cash,transfer,JSON.stringify(stock),note])).rows[0].result;
}
async function reviewAssistantClose(id,approve=true,note='Recibido y revisado'){return db.query('select public.trip_review_close($1,$2,$3,$4) as result',[tenant,id,approve,note]);}
it('rendicion del asistente no devuelve stock hasta aprobar; reintentos no duplican cierre ni aviso',async()=>{
 const v={...await deliveryFixture(),closeId:crypto.randomUUID()};await deliverVisit(v);const q=await assistantCloseQuote(v);expect(q).toMatchObject({cash:100,transfer:0,sales:200,pending_visits:0});await submitAssistantClose(v,q);await submitAssistantClose(v,q);
 expect((await preview(v.trip)).rows[0].result).toMatchObject({trip:{status:'submitted'},stock:[{ready:3,empties:1}]});await denied(()=>deliverVisit({...v,id:crypto.randomUUID()}),/no activo|activo/);
 await actor(owner);expect((await db.query("select * from public.owner_notifications where kind='trip_closure'")).rows).toHaveLength(1);await reviewAssistantClose(v.closeId);await reviewAssistantClose(v.closeId);expect((await db.query("select * from public.inventory_operations where trip_id=$1 and kind='close'",[v.trip])).rows).toHaveLength(1);
 const history=(await db.query('select public.owner_assistant_close_inbox($1) as h',[tenant])).rows[0].h;expect(history[0]).toMatchObject({closure_state:'approved',trip:{status:'closed'},declared_cash:100});expect(history[0].stock[0].ready).toBe(3);
 await actor(driver);expect(await submitAssistantClose(v,q)).toEqual({id:v.closeId});await denied(()=>preview(v.trip),/acceso finalizado/);await denied(()=>db.query('select public.assistant_close_state($1,$2)',[tenant,v.trip]),/Acceso al reparto finalizado/);
});
it('diferencias se declaran con nota pero no se aprueban; observar permite corregir con nuevo ID',async()=>{
 const v={...await deliveryFixture(),closeId:crypto.randomUUID()};await deliverVisit(v);const q=await assistantCloseQuote(v);await denied(()=>submitAssistantClose(v,q,{cash:0,note:''}),/observacion/);await submitAssistantClose(v,q,{cash:0,note:'Falta revisar efectivo'});
 await actor(owner);await denied(()=>reviewAssistantClose(v.closeId),/Hay diferencias/);expect((await db.query('select status from public.trip_closures where id=$1',[v.closeId])).rows[0].status).toBe('submitted');await denied(()=>reviewAssistantClose(v.closeId,false,''),/observacion/);await reviewAssistantClose(v.closeId,false,'Recontar caja');await reviewAssistantClose(v.closeId,false,'Recontar caja');
 await actor(driver);expect((await db.query('select public.assistant_close_state($1,$2) as s',[tenant,v.trip])).rows[0].s).toMatchObject({closure_state:'observed',decision_note:'Recontar caja'});const next={...v,closeId:crypto.randomUUID()};await submitAssistantClose(next,await assistantCloseQuote(v));await actor(owner);await reviewAssistantClose(next.closeId);expect((await db.query("select * from public.inventory_operations where kind='close' and trip_id=$1",[v.trip])).rows).toHaveLength(1);
});
it('resumen obsoleto y paradas pendientes bloquean la presentacion sin efectos parciales',async()=>{
 const v={...await deliveryFixture(),closeId:crypto.randomUUID()};const pending=await assistantCloseQuote(v);await denied(()=>submitAssistantClose(v,pending),/clientes sin resultado/);await deliverVisit(v);const q=await assistantCloseQuote(v);await db.exec('reset role');await db.query('update public.route_stops set version=version+1 where trip_id=$1',[v.trip]);await actor(driver);await denied(()=>submitAssistantClose(v,q),/reparto cambio/);await actor(owner);expect((await db.query('select * from public.assistant_trip_close_snapshots')).rows).toHaveLength(0);expect((await db.query('select * from public.trip_closures')).rows).toHaveLength(0);
});
it('cambios posteriores a la presentacion impiden aprobar y preservan el historial presentado',async()=>{
 const v={...await deliveryFixture(),closeId:crypto.randomUUID()};await deliverVisit(v);await submitAssistantClose(v,await assistantCloseQuote(v));await actor(owner);await db.query("update public.products set name='Nombre editado' where id=$1",[v.product]);await denied(()=>reviewAssistantClose(v.closeId),/reparto cambio/);const h=(await db.query('select public.owner_assistant_close_inbox($1) as h',[tenant])).rows[0].h[0];expect(h.stock[0].name).toBe('Agua visita');expect(h.closure_state).toBe('submitted');expect((await db.query("select * from public.inventory_operations where kind='close'",[])).rows).toHaveLength(0);
});
it('preview compartido elimina costos privados y rechaza otros actores y permisos generales',async()=>{
 const v=await initialLoadFixture();await confirmAssistantLoad(v);const q=await assistantCloseQuote(v);expect(JSON.stringify(q)).not.toContain('unit_cost');expect(JSON.stringify(q)).not.toContain('filling_cost');expect(q.initial_load[0]).toMatchObject({loaded:4});await actor(second);await denied(()=>assistantCloseQuote(v),/Solo el asistente/);await denied(()=>submitAssistantClose(v,q),/no aceptado/);await actor(driver);await denied(()=>db.query('select public.owner_assistant_close_inbox($1)',[tenant]),/Solo el jefe/);await actor(otherOwner);await denied(()=>reviewAssistantClose(crypto.randomUUID()),/Solo el jefe/);await db.exec('reset role;set local role anon');await denied(()=>assistantCloseQuote(v),/permission denied/);
});

async function approvedAssistantReceipt(){const v={...await deliveryFixture(),closeId:crypto.randomUUID()};await deliverVisit(v);await submitAssistantClose(v,await assistantCloseQuote(v));await actor(owner);await reviewAssistantClose(v.closeId);return v;}
it('comprobante aprobado ofrece copia completa al jefe y proyeccion minima al propio asistente',async()=>{
 const v=await approvedAssistantReceipt();const ownerReceipt=(await db.query('select public.trip_close_receipt($1,$2) as r',[tenant,v.closeId])).rows[0].r;expect(ownerReceipt).toMatchObject({role:'owner',receipt:{id:v.closeId,sales:200,declared_transfer:0,declared_cash:100}});
 await actor(driver);const r=(await db.query('select public.trip_close_receipt($1,$2) as r',[tenant,v.closeId])).rows[0].r;expect(r).toMatchObject({role:'driver',receipt:{id:v.closeId,declared_cash:100,closure_state:'approved'}});for(const key of ['sales','transfer','declared_transfer','cash','revision','request','unit_cost'])expect(r.receipt).not.toHaveProperty(key);expect((await db.query('select public.assistant_close_receipts() as h')).rows[0].h).toHaveLength(1);await denied(()=>preview(v.trip),/acceso finalizado/);
 await actor(second);expect((await db.query('select public.assistant_close_receipts() as h')).rows[0].h).toHaveLength(0);await denied(()=>db.query('select public.trip_close_receipt($1,$2)',[tenant,v.closeId]),/no disponible/);await actor(otherOwner);await denied(()=>db.query('select public.trip_close_receipt($1,$2)',[tenant,v.closeId]),/no disponible/);
});
it('historial propio persiste sin vinculo o licencia y no concede acceso a la empresa',async()=>{
 const v=await approvedAssistantReceipt();await link(tenant,driver,false);await db.exec('reset role');await db.query("update public.licenses set status='suspended' where tenant_id=$1",[tenant]);await actor(driver);expect((await db.query('select public.assistant_close_receipts() as h')).rows[0].h[0].id).toBe(v.closeId);expect((await db.query('select * from public.customers')).rows).toHaveLength(0);expect((await db.query('select * from public.assistant_trip_close_snapshots')).rows).toHaveLength(0);await denied(()=>preview(v.trip),/acceso finalizado/);
 await actor(owner);await denied(()=>db.query('select public.trip_close_receipt($1,$2)',[tenant,v.closeId]),/no disponible/);
});
it('ni presentacion ni observacion generan comprobante aprobado; anonimos y no confirmados no acceden',async()=>{
 const v={...await deliveryFixture(),closeId:crypto.randomUUID()};await deliverVisit(v);await submitAssistantClose(v,await assistantCloseQuote(v));expect((await db.query('select public.assistant_close_receipts() as h')).rows[0].h).toHaveLength(0);await denied(()=>db.query('select public.trip_close_receipt($1,$2)',[tenant,v.closeId]),/no disponible/);await actor(owner);await reviewAssistantClose(v.closeId,false,'Revisar conteo');await actor(driver);expect((await db.query('select public.assistant_close_receipts() as h')).rows[0].h).toHaveLength(0);await actor(unconfirmed);await denied(()=>db.query('select public.assistant_close_receipts()'),/Cuenta no verificada/);await db.exec('reset role;set local role anon');await denied(()=>db.query('select public.assistant_close_receipts()'),/permission denied/);
});
it('comprobante guarda nombres del cierre aunque cambien empresa catalogo y perfil despues',async()=>{
 const v=await approvedAssistantReceipt();await db.query("update public.products set name='Nombre nuevo' where id=$1",[v.product]);await db.exec('reset role');await db.query("update public.tenants set name='Empresa renombrada' where id=$1",[tenant]);await actor(driver);const h=(await db.query('select public.assistant_close_receipts() as h')).rows[0].h[0];expect(h.company).toBe('Empresa A');expect(h.stock[0].name).toBe('Agua visita');expect(h.initial_load[0].name).toBe('Agua visita');
});

async function equipmentTripFixture(asAssistant=false,state='good'){
 const v=await dispenserContract();let trip;
 if(asAssistant){trip=await assigned();await actor(driver);await answer(trip);await actor(owner);}
 else{trip=crypto.randomUUID();await db.query("select public.inventory_create_trip($1,$2,$3,'Equipos',current_date,$4)",[tenant,trip,owner,[v.customer]]);}
 await db.query("select public.inventory_post($1,$2,'load',$3,null,$4,'')",[tenant,crypto.randomUUID(),trip,JSON.stringify([{product_id:v.replacement,quantity:1}])]);
 const ids=await exchange(v,{trip,state});return {...v,trip,...ids};
}
it('detalle de cambios no duplica retorno y asignacion de reemplazo; queda congelado en cierre propio',async()=>{
 const v=await equipmentTripFixture();await db.query("select public.inventory_assign_dispenser_model($1,$2,$3,$4,'loan',0,current_date,$5)",[tenant,crypto.randomUUID(),v.old,v.customer,v.trip]);await recordAssistantVisit(v);const q=await ownerCloseQuote(v);expect(q.equipment_detail.models).toHaveLength(2);expect(q.equipment_detail.models.map(e=>e.kind).sort()).toEqual(['assigned','exchanged']);expect(q.equipment_detail.models.find(e=>e.kind==='exchanged')).toMatchObject({state:'good',quantity:1});
 const receipt=await finishOwner(v,q);await db.query("update public.products set name='Modelo renombrado' where tenant_id=$1 and id=$2",[tenant,v.old]);const h=(await db.query('select public.owner_self_close_history($1) as h',[tenant])).rows[0].h[0];expect(h.equipment_detail).toEqual(receipt.equipment_detail);expect(JSON.stringify(h.equipment_detail)).not.toContain('Modelo renombrado');
});
it('retirado roto figura en detalle pero no se acredita como unidad disponible del camion',async()=>{
 const v=await equipmentTripFixture(false,'broken');const q=await ownerCloseQuote(v);expect(q.equipment_detail.models).toHaveLength(1);expect(q.equipment_detail.models[0]).toMatchObject({kind:'exchanged',state:'broken'});expect(q.stock.find(p=>p.product_id===v.old)).toBeUndefined();
});
it('equipo por serie muestra carga y regreso vinculados sin inventar un cambio',async()=>{
 const v=await costLoadFixture();await confirmCostLoad(v);const asset=crypto.randomUUID();
 await db.query("select public.inventory_save_dispenser($1,$2,$3,'Equipo identificado','EQ-TEST','company','truck',null,$4,null,0)",[tenant,crypto.randomUUID(),asset,v.trip]);const before=await ownerCloseQuote(v);expect(before.equipment_count).toBe(1);expect(before.equipment_detail.serialized[0]).toMatchObject({kind:'loaded',serial:'EQ-TEST'});
 await db.query("select public.inventory_save_dispenser($1,$2,$3,'Equipo identificado','EQ-TEST','company','depot',null,null,null,0)",[tenant,crypto.randomUUID(),asset]);await recordAssistantVisit(v);const q=await ownerCloseQuote(v);expect(q.equipment_count).toBe(0);expect(q.equipment_detail.serialized.map(e=>e.kind).sort()).toEqual(['loaded','returned']);await finishOwner(v,q);
});
it('comprobante del asistente comparte detalle sin cliente alquiler responsable ni costos',async()=>{
 const v=await equipmentTripFixture(true);await actor(driver);await recordAssistantVisit(v);const q=await assistantCloseQuote(v);expect(q.equipment_detail.models).toHaveLength(1);const closeId=crypto.randomUUID();await submitAssistantClose({...v,closeId},q);await actor(owner);await reviewAssistantClose(closeId);await actor(driver);const r=(await db.query('select public.trip_close_receipt($1,$2) as r',[tenant,closeId])).rows[0].r.receipt;expect(r.equipment_detail).toEqual(q.equipment_detail);const detail=JSON.stringify(r.equipment_detail);for(const field of ['customer_id','monthly','involved_id','unit_cost',v.customer])expect(detail).not.toContain(field);await denied(()=>db.query('select private.trip_equipment_close_detail($1,$2)',[tenant,v.trip]),/permission denied/);
});
it('rendicion antigua sin detalle se aprueba sin reconstruir movimientos nuevos',async()=>{
 const v={...await deliveryFixture(),closeId:crypto.randomUUID()};await deliverVisit(v);await submitAssistantClose(v,await assistantCloseQuote(v));await db.exec('reset role');await db.query("update public.assistant_trip_close_snapshots set request=jsonb_set(request,'{expected}',(request->'expected')-'equipment_detail'),snapshot=snapshot-'equipment_detail' where tenant_id=$1 and id=$2",[tenant,v.closeId]);await actor(owner);await reviewAssistantClose(v.closeId);const h=(await db.query('select public.owner_assistant_close_inbox($1) as h',[tenant])).rows[0].h[0];expect(h.closure_state).toBe('approved');expect(h).not.toHaveProperty('equipment_detail');
});

async function windowFixture(){const v=await deliveryFixture();await actor(owner);await db.query("select public.customer_set_visit_window($1,$2,'16:00','17:00')",[tenant,v.customer]);await db.exec('reset role');await db.exec("update private.web_push_config set enabled=true,public_key=repeat('A',87)");await actor(driver);await db.query('select public.push_subscribe($1::jsonb)',[JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/ficticio',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}})]);return v;}
async function claimAt(time){await db.exec('reset role');return (await db.query("select public.push_claim_visit_notifications(20,(current_date+$1::time) at time zone 'America/Argentina/Buenos_Aires') as jobs",[time])).rows[0].jobs;}
it('horario se muestra en ruta aceptada y asistente no puede editar horarios',async()=>{
 const v=await windowFixture();const route=(await preview(v.trip)).rows[0].result;expect(route.stops[0]).toMatchObject({visit_start:'16:00',visit_end:'17:00',reminder_dismissed:false});await denied(()=>db.query("select public.customer_set_visit_window($1,$2,'18:00','19:00')",[tenant,v.customer]),/Solo el jefe/);await actor(owner);await denied(()=>db.query("select public.customer_set_visit_window($1,$2,'17:00','16:00')",[tenant,v.customer]),/horario/);
});
it('cron genera aviso a las 15, luego 15:30 sin duplicar por minuto y solo para destinatario',async()=>{
 await windowFixture();expect(await claimAt('14:59')).toHaveLength(0);const first=await claimAt('15:00');expect(first).toHaveLength(1);expect(first[0].user_id).toBe(driver);expect(await claimAt('15:01')).toHaveLength(0);await db.query("select public.push_finish_job($1,$2,'sent')",[first[0].id,first[0].claim_token]);expect(await claimAt('15:10')).toHaveLength(0);expect(await claimAt('15:30')).toHaveLength(1);
});
it('no llegue detiene siguientes avisos sin crear entrega o cambiar estado de visita',async()=>{
 const v=await windowFixture();await db.query('select public.route_dismiss_time_reminder($1,$2,$3)',[tenant,v.trip,v.customer]);await db.query('select public.route_dismiss_time_reminder($1,$2,$3)',[tenant,v.trip,v.customer]);expect(await claimAt('15:30')).toHaveLength(0);await actor(driver);const route=(await preview(v.trip)).rows[0].result;expect(route.stops[0]).toMatchObject({reminder_dismissed:true,outcome:'pending'});expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
});
it('entrega detiene avisos, endpoints internos no accesibles por usuario',async()=>{
 const v=await windowFixture();await deliverVisit(v);expect(await claimAt('15:00')).toHaveLength(0);await actor(driver);await denied(()=>db.query('select public.push_claim_visit_notifications()'),/permission denied/);await denied(()=>db.query('select * from private.web_push_subscriptions'),/permission denied/);
});
it('revocacion impide avisos aunque dispositivo siga suscripto',async()=>{
 const v=await windowFixture();await actor(owner);await db.query('select public.owner_revoke_trip_invitation($1,$2,$3)',[tenant,v.trip,crypto.randomUUID()]);expect(await claimAt('15:00')).toHaveLength(0);
});
it('suscripcion rechaza destinos arbitrarios y otro usuario no puede apropiarse del celular',async()=>{
 await windowFixture();await actor(second);await denied(()=>db.query('select public.push_subscribe($1::jsonb)',[JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/ficticio',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}})]),/otra cuenta/);await denied(()=>db.query('select public.push_subscribe($1::jsonb)',[JSON.stringify({endpoint:'https://127.0.0.1/privado',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}})]),/no valida/);
});

it('licencia suspendida impide avisos aunque dispositivo siga suscripto',async()=>{
 await windowFixture();await db.exec('reset role');await db.query("update public.licenses set status='suspended' where tenant_id=$1",[tenant]);expect(await claimAt('15:00')).toHaveLength(0);
});
