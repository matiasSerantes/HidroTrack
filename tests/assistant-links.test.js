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
