import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// PostgreSQL real en WASM; solo el contrato mínimo de Auth se prepara como fixture.
// No sustituye las pruebas de integración contra Supabase Auth/PostgREST.
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
  `);
  for (const name of ['20261017193404_foundation', '20261017222129_admin_portal', '20261019160747_inventory', '20261019162655_owned_inventory', '20261019163826_user_profiles','20261020130955_inventory_incidents','20261020130959_dispenser_model_assignments','20261020131002_product_archive_guard','20261020131006_admin_member_access','20261020131010_admin_access_history','20261020131730_commerce','20261020132835_route_workflow','20261020132839_customer_recovery','20261020132843_trip_closures','20261020133327_database_guards','20261020134314_rental_billing','20261020134546_dispenser_delivery_guard']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
}, 30000);
afterAll(async () => { await db.close(); });
describe('migración y seguridad PostgreSQL', () => {
  it('detecta todos los componentes de las tres actualizaciones de inventario', async () => {
    await db.exec('begin read only');
    try {
      const sql = await readFile(new URL('../supabase/tests/inventory_preflight.sql', import.meta.url), 'utf8');
      const { rows } = await db.query(sql);
      expect(rows.map(row => row.component_status)).toEqual(['present', 'present', 'present']);
      expect(rows.every(row => row.missing_components === null)).toBe(true);
    } finally { await db.exec('rollback'); }
  });
  it('ejecuta la verificación posterior de incidentes sin modificar datos',async()=>{
    await db.exec(await readFile(new URL('../supabase/tests/inventory_incidents_verify.sql',import.meta.url),'utf8'));
    expect((await db.query('select count(*)::int as count from public.inventory_operations')).rows[0].count).toBe(0);
  });
  it('verifica permisos y consistencia de ventas, recorridos y cierres sin modificar datos',async()=>{
    await db.exec(await readFile(new URL('../supabase/tests/beta_database_verify.sql',import.meta.url),'utf8'));
  });
  it('protege el directorio y limita el alta de choferes desde el servidor', async () => {
    await db.exec(`begin;
      insert into auth.users(id,email) values
      ('00000000-0000-0000-0000-000000000001','admin@example.test'),
      ('00000000-0000-0000-0000-000000000002','owner@example.test'),
      ('00000000-0000-0000-0000-000000000003','driver@example.test'),
      ('00000000-0000-0000-0000-000000000004','driver2@example.test');
      insert into public.platform_admins values('00000000-0000-0000-0000-000000000001');
      do $$ declare t uuid; begin
       begin
        perform public.admin_directory();
        raise exception 'Directory leaked';
       exception when insufficient_privilege then null; end;
       begin
        perform public.admin_provision('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Forbidden',null,'owner','permanent',null,1);
        raise exception 'Unauthorized provisioning';
       exception when insufficient_privilege then null; end;
       t:=public.admin_provision('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Test',null,'owner','permanent',null,1);
       perform public.admin_provision('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',null,t,'driver',null,null,null);
       begin
        perform public.admin_provision('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004',null,t,'driver',null,null,null);
        raise exception 'Limit not enforced';
       exception when raise_exception then if SQLERRM <> 'Límite de choferes alcanzado' then raise; end if; end;
       if jsonb_array_length(public.admin_directory())<>1 then raise exception 'Missing directory'; end if;
       if not exists(select 1 from public.license_events where tenant_id=t and actor_id='00000000-0000-0000-0000-000000000001') then raise exception 'Missing audit actor'; end if;
       if has_function_privilege('authenticated','public.admin_provision(uuid,uuid,text,uuid,text,text,timestamptz,integer)','execute') then raise exception 'Provision exposed'; end if;
      end $$;
      rollback;`);
  });
  it('activa RLS en todas las tablas comerciales y administrativas', async () => {
    const { rows } = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`);
    expect(rows).toHaveLength(29);
    expect(rows.every(row => row.relrowsecurity)).toBe(true);
  });
  it('ejecuta escenarios de aislamiento, roles, licencias y auditoría con rollback', async () => {
    const sql = await readFile(new URL('../supabase/tests/isolation.sql', import.meta.url), 'utf8');
    await db.exec(sql.replace(/^\\set.*$/gm, ''));
    expect((await db.query('select count(*)::int as count from public.tenants')).rows[0].count).toBe(0);
  });
});

const tenant = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const owner = '20000000-0000-0000-0000-000000000001';
const driver = '20000000-0000-0000-0000-000000000002';
const stranger = '20000000-0000-0000-0000-000000000003';
const product = '30000000-0000-0000-0000-000000000001';
const product2 = '30000000-0000-0000-0000-000000000002';
const customer = '40000000-0000-0000-0000-000000000001';
const trip = '50000000-0000-0000-0000-000000000001';
const nextTrip = '50000000-0000-0000-0000-000000000002';
let operationNumber = 0;
const op = () => `60000000-0000-0000-0000-${String(++operationNumber).padStart(12, '0')}`;
const items = (quantity, returned = 0) => [{ product_id: product, quantity, returned }];
async function as(user) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  await db.exec('set local role authenticated');
}
const post = (kind, lines, id = op(), tripId = kind === 'receive' ? null : trip, customerId = kind === 'delivery' ? customer : null) => db.query('select public.inventory_post($1,$2,$3,$4,$5,$6::jsonb)', [tenant,id,kind,tripId,customerId,JSON.stringify(lines)]);
const createTrip = (id = trip) => db.query("select public.inventory_create_trip($1,$2,$3,'Reparto de prueba','2026-10-19',$4::uuid[])", [tenant,id,driver,[customer]]);
async function rejected(action, message) {
  await db.exec('savepoint expected_failure');
  try { await expect(action()).rejects.toThrow(message); }
  finally { await db.exec('rollback to savepoint expected_failure'); }
}
describe('stock transaccional PostgreSQL', () => {
  beforeEach(async () => {
    await db.exec(`begin;
      insert into auth.users(id) values('${owner}'),('${driver}'),('${stranger}');
      insert into public.tenants(id,name) values('${tenant}','Agua prueba'),('${other}','Otra empresa');
      insert into public.tenant_members(tenant_id,user_id,role) values('${tenant}','${owner}','owner'),('${tenant}','${driver}','driver'),('${other}','${stranger}','owner');
      insert into public.licenses(tenant_id,kind,status,driver_limit) values('${tenant}','permanent','active',3),('${other}','permanent','active',3);
      insert into public.products(id,tenant_id,name,price,returnable) values('${product}','${tenant}','Bidón 20',3500,true),('${product2}','${tenant}','Soda',1200,true);
      insert into public.customers(id,tenant_id,name,address) values('${customer}','${tenant}','Cliente prueba','Calle 100');`);
    await as(owner);
  });
  afterEach(async () => { await db.exec('rollback; reset role'); });

  const deliver = (id, paid=0, method=null, quantity=2) => db.query('select public.commerce_deliver($1,$2,$3,$4,$5::jsonb,$6,$7)',[tenant,id,trip,customer,JSON.stringify(items(quantity)),paid,method]);
  async function readyCommerce() {
    await post('receive',items(10)); await createTrip(); await post('load',items(10)); await as(driver);
  }
  const pay = (sale, amount, id=op(), method='cash') => db.query("select public.commerce_record_payment($1,$2,$3,$4,$5,'2026-10-20',$6)",[tenant,id,sale,amount,method,trip]);
  it('registra entrega y cobro parcial atómicos con precio de servidor y deuda separada',async()=>{
    await readyCommerce(); const id=op(); await deliver(id,2000,'cash');
    const sale=(await db.query('select * from public.customer_sale_balances where id=$1',[id])).rows[0];
    expect(Number(sale.total)).toBe(7000); expect(Number(sale.paid)).toBe(2000); expect(Number(sale.balance)).toBe(5000); expect(sale.credit_status).toBe('pending');
    await as(owner); await db.query('update public.products set price=9000 where id=$1',[product]);
    expect(Number((await db.query('select unit_price from public.sale_items where sale_id=$1',[id])).rows[0].unit_price)).toBe(3500);
    expect((await db.query('select * from public.owner_notifications')).rows).toHaveLength(2);
    await as(stranger); expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
    await db.exec('reset role'); await db.exec(`insert into public.platform_admins values('${stranger}')`); await as(stranger);
    expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
  });
  it('rechazar crédito conserva saldo del cliente y no vuelve a descontar stock',async()=>{
    await readyCommerce(); const id=op(); await deliver(id,2000,'transfer');
    await rejected(()=>db.query('select public.commerce_review_credit($1,$2,false)',[tenant,id]),'Solo el jefe');
    await as(owner); await db.query("select public.commerce_review_credit($1,$2,false,'Cobrar próxima visita')",[tenant,id]);
    await db.query("select public.commerce_review_credit($1,$2,false,'Cobrar próxima visita')",[tenant,id]);
    const sale=(await db.query('select * from public.customer_sale_balances where id=$1',[id])).rows[0];
    expect(Number(sale.balance)).toBe(5000); expect(sale.credit_status).toBe('rejected');
    await pay(id,5000);
    expect(Number((await db.query('select balance from public.customer_sale_balances where id=$1',[id])).rows[0].balance)).toBe(0);
    expect(Number((await db.query('select ready from public.inventory_truck_stock')).rows[0].ready)).toBe(8);
  });
  it('reintentos no duplican entrega ni pago y rechazan cambios de importe o artículos',async()=>{
    await readyCommerce(); const id=op(); await deliver(id,1000,'cash'); await deliver(id,1000,'cash');
    await rejected(()=>deliver(id,2000,'cash'),'otro cobro');
    await rejected(()=>deliver(id,1000,'cash',3),'otros datos');
    expect((await db.query('select * from public.sales')).rows).toHaveLength(1);
    expect((await db.query('select * from public.payments')).rows).toHaveLength(1);
    const payment=op(); await pay(id,1000,payment); await pay(id,1000,payment);
    await rejected(()=>pay(id,2000,payment),'otros datos');
    expect((await db.query('select * from public.payments')).rows).toHaveLength(2);
  });
  it('una entrega sin cobro no cambia a cobrada al reintentar el mismo ID',async()=>{
    await readyCommerce(); const zero=op(); await deliver(zero);
    await rejected(()=>deliver(zero,100,'cash'),'otro cobro');
  });
  it('un sobrepago revierte también entrega, envases, notificaciones y venta',async()=>{
    await readyCommerce(); await rejected(()=>deliver(op(),8000,'cash'),'supera el saldo');
    expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
    expect(Number((await db.query('select ready from public.inventory_truck_stock')).rows[0].ready)).toBe(10);
    await as(owner); expect((await db.query('select * from public.owner_notifications')).rows).toHaveLength(0);
  });
  it('la RPC anterior también genera venta y no permite omitir contabilidad',async()=>{
    await readyCommerce(); const id=op(); await post('delivery',items(1),id);
    expect(Number((await db.query('select total from public.sales')).rows[0].total)).toBe(3500);
    await rejected(()=>db.query("select private.inventory_post_core($1,$2,'delivery',$3,$4,$5::jsonb,'')",[tenant,op(),trip,customer,JSON.stringify(items(1))]),/permission denied/);
    await rejected(()=>db.exec('delete from public.sales'),/permission denied/);
    await as(stranger); await rejected(()=>pay(id,100),'Acceso denegado');
  });
  it('pago completo liquida solicitud pendiente y evita cobrar más que el saldo',async()=>{
    await readyCommerce(); const id=op(); await deliver(id,7000,'cash');
    expect((await db.query('select status from public.credit_requests')).rows[0].status).toBe('settled');
    await rejected(()=>pay(id,1),'supera el saldo');
    await as(owner); await rejected(()=>db.query('select public.commerce_review_credit($1,$2,true)',[tenant,id]),'ya fue resuelta');
  });
  it('un chofer sin reparto activo no accede a cuenta corriente ni registra cobros',async()=>{
    await readyCommerce(); const id=op(); await deliver(id); await db.query('select public.inventory_submit_trip($1,$2)',[tenant,trip]);
    await rejected(()=>pay(id,100),'Reparto de cobro no válido');
    await as(owner); await post('close',items(8)); await as(driver);
    expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
    await rejected(()=>pay(id,100),'Venta no accesible');
  });
  it('solo el destinatario jefe puede leer y marcar sus notificaciones',async()=>{
    await readyCommerce(); await deliver(op());
    expect((await db.query('select * from public.owner_notifications')).rows).toHaveLength(0);
    await as(owner); const n=(await db.query('select * from public.owner_notifications')).rows[0];
    await db.query('select public.commerce_read_notification($1,$2)',[tenant,n.id]);
    const first=(await db.query('select read_at from public.owner_notifications where id=$1',[n.id])).rows[0].read_at;
    await db.query('select public.commerce_read_notification($1,$2)',[tenant,n.id]);
    expect((await db.query('select read_at from public.owner_notifications where id=$1',[n.id])).rows[0].read_at).toEqual(first);
  });
  it('registra ausencia y regreso con versión, sin cobrar ni mover stock',async()=>{
    await readyCommerce(); const id=op();
    const visit=()=>db.query("select public.route_record_visit($1,$2,$3,$4,'absent',1,'later_today','2026-10-19','Timbre sin respuesta')",[tenant,id,trip,customer]);
    await visit(); await visit();
    let stop=(await db.query('select * from public.route_stops')).rows[0];
    expect(stop.outcome).toBe('absent'); expect(stop.version).toBe(2);
    await rejected(()=>db.query("select public.route_record_visit($1,$2,$3,$4,'present',1)",[tenant,op(),trip,customer]),'La parada cambió');
    await db.query("select public.route_record_visit($1,$2,$3,$4,'present',2)",[tenant,op(),trip,customer]);
    expect((await db.query('select * from public.sales')).rows).toHaveLength(0);
    expect(Number((await db.query('select ready from public.inventory_truck_stock')).rows[0].ready)).toBe(10);
    await deliver(op()); stop=(await db.query('select * from public.route_stops')).rows[0]; expect(stop.outcome).toBe('delivered');
    await rejected(()=>deliver(op()),'visita ya resuelta');
    expect((await db.query('select * from public.sales')).rows).toHaveLength(1);
  });
  it('el jefe retira paradas sin borrar historial y el asistente no las modifica',async()=>{
    await readyCommerce(); await rejected(()=>db.query('select public.route_edit_stop($1,$2,$3,$4,2,false,1)',[tenant,op(),trip,customer]),'Solo el jefe');
    await as(owner); const id=op();
    await db.query('select public.route_edit_stop($1,$2,$3,$4,2,false,1)',[tenant,id,trip,customer]);
    await db.query('select public.route_edit_stop($1,$2,$3,$4,2,false,1)',[tenant,id,trip,customer]);
    await as(driver); await rejected(()=>deliver(op()),'Parada retirada');
    expect((await db.query('select * from public.inventory_trip_customers')).rows).toHaveLength(1);
    await as(owner); await db.query('select public.route_edit_stop($1,$2,$3,$4,1,true,2)',[tenant,op(),trip,customer]); await as(driver); await deliver(op());
    await as(owner); await rejected(()=>db.query('select public.route_edit_stop($1,$2,$3,$4,1,false,4)',[tenant,op(),trip,customer]),'conserva su historial');
  });
  it('el manifiesto entrega deuda completa y envases solo del reparto autorizado',async()=>{
    await readyCommerce(); await deliver(op(),2000,'cash');
    const manifest=(await db.query('select public.route_manifest($1,$2) data',[tenant,trip])).rows[0].data;
    expect(Number(manifest[0].balance)).toBe(5000); expect(Number(manifest[0].containers[0].quantity)).toBe(2);
    await as(stranger); await rejected(()=>db.query('select public.route_manifest($1,$2)',[tenant,trip]),'Reparto no asignado');
  });
  it('ubicación con hora de servidor: solo propio reparto, dueño ve y se puede detener',async()=>{
    await readyCommerce(); await db.query('select public.route_publish_position($1,$2,-34.6,-58.4,12)',[tenant,trip]);
    await as(stranger); expect((await db.query('select * from public.driver_positions')).rows).toHaveLength(0);
    await as(owner); expect((await db.query('select * from public.driver_positions')).rows).toHaveLength(1);
    await rejected(()=>db.query('select public.route_publish_position($1,$2,-34.6,-58.4,12)',[tenant,trip]),'Solo el repartidor');
    await as(driver); await db.query('select public.route_stop_position($1)',[tenant]);
    expect((await db.query('select * from public.driver_positions')).rows).toHaveLength(0);
    await rejected(()=>db.query('select public.route_publish_position($1,$2,100,-58.4,12)',[tenant,trip]),/check constraint/);
  });
  it('futura baja bloquea entregas pero permite recuperar, conserva deuda y exige aprobación',async()=>{
    await db.query("select public.inventory_owner_stock($1,$2,'opening_customer',$3,$4::jsonb,'Inicial')",[tenant,op(),customer,JSON.stringify(items(2))]);
    await readyCommerce(); const request=op();
    const ask=()=>db.query("select public.customer_request_deactivation($1,$2,$3,'Deja el servicio')",[tenant,request,customer]);
    await ask(); await ask();
    expect((await db.query('select public.route_manifest($1,$2) data',[tenant,trip])).rows[0].data[0].pending_recovery).toBe(true);
    await rejected(()=>deliver(op()),'futura baja');
    await as(owner);
    await rejected(()=>db.query('select public.customer_review_deactivation($1,$2,true)',[tenant,request]),'pendiente de recuperación');
    await rejected(()=>db.query('update public.customers set active=false where id=$1',[customer]),'Resolver la futura baja');
    await as(driver); await post('delivery',items(0,2));
    await rejected(()=>db.query('select public.customer_review_deactivation($1,$2,true)',[tenant,request]),'Solo el jefe');
    await as(owner); await db.query('select public.customer_review_deactivation($1,$2,true)',[tenant,request]);
    await db.query('select public.customer_review_deactivation($1,$2,true)',[tenant,request]);
    const c=(await db.query('select * from public.customers')).rows[0]; expect(c.active).toBe(false); expect(c.pending_recovery).toBe(false);
    expect((await db.query('select * from public.customer_deactivations')).rows[0].status).toBe('approved');
    await as(driver); expect((await db.query('select public.route_manifest($1,$2) data',[tenant,trip])).rows[0].data).toHaveLength(0);
  });
  it('rechazar futura baja rehabilita entregas y no duplica avisos al jefe',async()=>{
    await readyCommerce(); const request=op();
    await db.query("select public.customer_request_deactivation($1,$2,$3,'Propuesta')",[tenant,request,customer]);
    await as(owner); expect((await db.query("select * from public.owner_notifications where kind='recovery_pending'")).rows).toHaveLength(1);
    await db.query("select public.customer_review_deactivation($1,$2,false,'Continúa')",[tenant,request]);
    expect((await db.query('select * from public.customers')).rows[0].pending_recovery).toBe(false);
    await as(driver); await deliver(op());
  });
  it('el archivo antiguo también exige recuperar envases aunque no haya solicitud',async()=>{
    await db.query("select public.inventory_owner_stock($1,$2,'opening_customer',$3,$4::jsonb,'Inicial')",[tenant,op(),customer,JSON.stringify(items(1))]);
    await rejected(()=>db.query('update public.customers set active=false where id=$1',[customer]),'primero recuperar');
  });
  const submitClose = (id,cash=1000,ready=8,note='') => db.query('select public.trip_submit_close($1,$2,$3,$4,0,$5::jsonb,$6)',[tenant,id,trip,cash,JSON.stringify([{product_id:product,ready,empties:0}]),note]);
  it('cuotas mensuales conservan ancla de entrega, precio pactado y unicidad por período',async()=>{
    await db.query("update public.products set family='dispenser' where id=$1",[product2]);
    await post('receive',[{product_id:product2,quantity:1}]); const assignment=op();
    await db.query("select public.inventory_assign_dispenser_model($1,$2,$3,$4,'rental',2500,'2026-01-31')",[tenant,assignment,product2,customer]);
    const first=op(),second=op();
    const bill=(id,period,date)=>db.query('select public.commerce_charge_rental($1,$2,$3,null,$4,$5)',[tenant,id,assignment,period,date]);
    await bill(first,1,'2026-02-28'); await bill(first,1,'2026-02-28');
    await bill(second,2,'2026-03-31');
    const charges=(await db.query('select monthly,period_start::text from public.rental_charges order by period')).rows;
    expect(charges.map(r=>r.period_start)).toEqual(['2026-02-28','2026-03-31']);
    expect(charges.every(r=>Number(r.monthly)===2500)).toBe(true);
    await rejected(()=>bill(op(),1,'2026-02-28'),'ya fue generada');
    await rejected(()=>bill(op(),3,'2026-03-31'),'períodos futuros');
    await db.query("select public.inventory_return_dispenser_model($1,$2,$3,'2026-10-20')",[tenant,op(),assignment]);
    await bill(first,1,'2026-02-28'); await rejected(()=>bill(op(),4,'2026-06-01'),'no activo');
    expect(Number((await db.query('select sum(balance) amount from public.customer_sale_balances')).rows[0].amount)).toBe(5000);
  });
  it('apertura de deuda no mueve stock, no se repite y se cobra como saldo anterior',async()=>{
    const id=op(); const opening=()=>db.query("select public.commerce_open_customer_balance($1,$2,$3,4000,'2026-10-01','Saldo anterior al sistema')",[tenant,id,customer]);
    await opening(); await opening();
    await rejected(()=>db.query("select public.commerce_open_customer_balance($1,$2,$3,4000,'2026-10-01','Otra apertura')",[tenant,op(),customer]),'no repetir apertura');
    expect((await db.query('select * from public.inventory_movements')).rows).toHaveLength(0);
    await readyCommerce(); await pay(id,1000); expect(Number((await db.query('select balance from public.customer_sale_balances where id=$1',[id])).rows[0].balance)).toBe(3000);
    await rejected(()=>post('delivery',items(1),id),'reservado por un cargo');
    await rejected(()=>db.query("select public.commerce_open_customer_balance($1,$2,$3,1,'2026-10-01','No autorizado')",[tenant,op(),customer]),'Solo el jefe');
  });
  it('un dispenser no se entrega ni se devuelve como si fuera un bidón',async()=>{
    await db.query("update public.products set family='dispenser' where id=$1",[product2]);
    await post('receive',[{product_id:product2,quantity:1}]); const assignment=op();
    await db.query("select public.inventory_assign_dispenser_model($1,$2,$3,$4,'loan',0,'2026-10-19')",[tenant,assignment,product2,customer]);
    await readyCommerce();
    await rejected(()=>post('delivery',[{product_id:product2,quantity:0,returned:1}]),'asignación o devolución');
    await as(owner); expect((await db.query('select status from public.dispenser_assignments')).rows[0].status).toBe('active');
    await db.query("select public.inventory_return_dispenser_model($1,$2,$3,'2026-10-20')",[tenant,op(),assignment]);
    expect((await db.query('select status from public.dispenser_assignments')).rows[0].status).toBe('returned');
  });
  it('rendición calcula caja de servidor y exige jefe antes de cerrar con pagos',async()=>{
    await readyCommerce(); await deliver(op(),1000,'cash');
    await db.query('select public.inventory_submit_trip($1,$2)',[tenant,trip]);
    await as(owner); await rejected(()=>post('close',items(8)),'rendición de caja');
    await as(driver); const id=op(); await submitClose(id); await submitClose(id);
    await rejected(()=>db.query('select public.trip_review_close($1,$2,true)',[tenant,id]),'Solo el jefe');
    await as(owner); await db.query('select public.trip_review_close($1,$2,true)',[tenant,id]); await db.query('select public.trip_review_close($1,$2,true)',[tenant,id]);
    const c=(await db.query('select * from public.trip_closures')).rows[0]; expect(c.status).toBe('approved'); expect(Number(c.expected_cash)).toBe(1000);
    expect((await db.query('select status from public.inventory_trips')).rows[0].status).toBe('closed');
    expect(Number((await db.query('select depot_ready from public.inventory_owned_stock')).rows[0].depot_ready)).toBe(8);
    expect((await db.query("select * from public.inventory_operations where kind='close'")).rows).toHaveLength(1);
  });
  it('diferencias de caja requieren observación y pueden volver al chofer sin borrar la declaración',async()=>{
    await readyCommerce(); await deliver(op(),1000,'cash');
    await rejected(()=>submitClose(op(),900),'requieren observación');
    const id=op(); await submitClose(id,900,8,'Faltan cien');
    await as(owner); await rejected(()=>db.query('select public.trip_review_close($1,$2,true)',[tenant,id]),'Justificá las diferencias');
    await db.query("select public.trip_review_close($1,$2,false,'Revisar efectivo')",[tenant,id]);
    expect((await db.query('select status from public.inventory_trips')).rows[0].status).toBe('active');
    await as(driver); const next=op(); await submitClose(next); await as(owner); await db.query('select public.trip_review_close($1,$2,true)',[tenant,next]);
    expect((await db.query('select * from public.trip_closures')).rows).toHaveLength(2);
  });
  it('faltante declarado conserva esperado y exige conciliar inventario antes de aprobar',async()=>{
    await readyCommerce(); await deliver(op(),1000,'cash'); const id=op(); await submitClose(id,1000,7,'Se rompió uno');
    await as(owner); await rejected(()=>db.query("select public.trip_review_close($1,$2,true,'Rotura a verificar')",[tenant,id]),'Conciliá roturas');
    await db.query("select public.inventory_remove($1,$2,'damage',$3,1,'truck_ready',$4,null,'2026-10-20','driver',$5,'Rotura verificada')",[tenant,op(),product,trip,driver]);
    await db.query("select public.trip_review_close($1,$2,true,'Rotura verificada')",[tenant,id]);
    const c=(await db.query('select * from public.trip_closures')).rows[0]; expect(Number(c.expected_stock[0].ready)).toBe(8); expect(Number(c.declared_stock[0].ready)).toBe(7); expect(c.status).toBe('approved');
  });

  it('crea perfiles sin credenciales ni autoasignación de roles y aísla otros repartos', async()=>{
    expect((await db.query('select * from public.user_profiles')).rows).toHaveLength(2);
    await db.query('update public.user_profiles set full_name=$1 where user_id=$2',['Jefe de prueba',owner]);
    await as(driver);
    expect((await db.query('select user_id from public.user_profiles')).rows.map(p=>p.user_id)).toEqual([driver]);
    await rejected(()=>db.query('update public.user_profiles set user_id=$1 where user_id=$2',[stranger,driver]),/permission denied/);
    await rejected(()=>db.exec(`insert into public.user_profiles(user_id,full_name) values('${stranger}','Intruso')`),/permission denied/);
    await as(stranger); expect((await db.query('select * from public.user_profiles')).rows).toHaveLength(1);
    await db.exec('reset role');
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",['20000000-0000-0000-0000-000000000004',{full_name:'Nuevo asistente',role:'owner'}]);
    expect((await db.query("select full_name from public.user_profiles where user_id='20000000-0000-0000-0000-000000000004'")).rows[0].full_name).toBe('Nuevo asistente');
    expect((await db.query("select * from public.tenant_members where user_id='20000000-0000-0000-0000-000000000004'")).rows).toHaveLength(0);
  });

  it('ingresa, carga una vez y descuenta entregas con envases e importe histórico', async () => {
    await post('receive', items(40)); await createTrip(); await as(driver);
    await post('load', items(10));
    await post('delivery', items(3,1));
    const stock = (await db.query('select * from public.inventory_truck_stock')).rows[0];
    expect(Number(stock.loaded)).toBe(10); expect(Number(stock.ready)).toBe(7);
    expect(Number(stock.empties)).toBe(1); expect(Number(stock.delivered_amount)).toBe(10500);
    expect((await db.query('select * from public.inventory_depot_stock')).rows).toHaveLength(0);
    await as(owner);
    expect(Number((await db.query('select ready from public.inventory_depot_stock')).rows[0].ready)).toBe(30);
    expect(Number((await db.query('select quantity from public.inventory_customer_containers')).rows[0].quantity)).toBe(2);
    await db.exec(`update public.products set price=5000 where id='${product}'`);
    expect(Number((await db.query('select delivered_amount from public.inventory_truck_stock')).rows[0].delivered_amount)).toBe(10500);
    await rejected(() => db.exec(`update public.products set returnable=false where id='${product}'`), /movimientos/);
  });

  it('reintentos idénticos no duplican y una carga distinta queda bloqueada', async () => {
    const receive = op(); await post('receive', items(30), receive); await post('receive', items(30), receive);
    await rejected(() => post('receive',items(31),receive), /otros datos/);
    await createTrip(); await createTrip(); await as(driver);
    const load = op(); await post('load',items(10),load); await post('load',items(10),load);
    await rejected(() => post('load',items(5)), /Carga ya confirmada/);
    const delivery = op(); await post('delivery',items(2),delivery); await post('delivery',items(2),delivery);
    expect(Number((await db.query('select ready from public.inventory_truck_stock')).rows[0].ready)).toBe(8);
    expect((await db.query('select * from public.inventory_operations')).rows).toHaveLength(2);
  });

  it('falla toda la operación si un artículo no tiene saldo o hay cantidades inválidas', async () => {
    await post('receive',items(10)); await createTrip();
    await rejected(() => post('load',[...items(5),{product_id:product2,quantity:1}]), /insuficiente/);
    expect((await db.query('select * from public.inventory_truck_stock')).rows).toHaveLength(0);
    expect((await db.query('select status from public.inventory_trips')).rows[0].status).toBe('planned');
    await rejected(() => post('load',items(1.5)), /enteras/);
    await rejected(() => post('load',[...items(1),...items(1)]), /repetido/);
    await post('load',items(5));
    await rejected(() => post('delivery',items(6)), /insuficiente/);
    await rejected(() => post('delivery',items(1,2)), /más envases/);
    expect(Number((await db.query('select ready from public.inventory_truck_stock')).rows[0].ready)).toBe(5);
  });

  it('aísla empresas, impide escritura directa y no permite cargar al asistente otro reparto', async () => {
    await post('receive',items(10)); await createTrip();
    await rejected(() => db.exec(`insert into public.inventory_movements(tenant_id,operation_id,product_id,unit_price,truck_ready) values('${tenant}','${op()}','${product}',0,100)`), /permission denied/);
    await as(stranger);
    expect((await db.query('select * from public.inventory_trips')).rows).toHaveLength(0);
    await rejected(() => post('load',items(1)), /denegado/);
    await as(driver);
    await rejected(() => post('receive',items(1)), /Solo el jefe/);
    await rejected(() => createTrip(nextTrip), /denegado/);
    await db.exec('reset role');
    await db.exec(`update public.tenant_members set active=false where user_id='${driver}'`);
    await as(driver); await rejected(() => post('load',items(1)), /denegado/);
    await as(owner);
    await db.exec('reset role'); await db.exec(`update public.licenses set status='suspended' where tenant_id='${tenant}'`);
    await as(owner); await rejected(() => post('receive',items(1)), /denegado/);
  });

  it('rechaza artículos ajenos, clientes no asignados, otro chofer y acceso anónimo', async () => {
    await db.exec('reset role');
    await db.exec(`insert into public.products(id,tenant_id,name,price) values('30000000-0000-0000-0000-000000000003','${other}','Ajeno',1);
      insert into public.customers(id,tenant_id,name,address) values('40000000-0000-0000-0000-000000000002','${tenant}','No asignado','Otra calle');`);
    await as(owner);
    await rejected(() => post('receive',[{product_id:'30000000-0000-0000-0000-000000000003',quantity:10}]), /no habilitado/);
    await post('receive',items(10)); await createTrip();
    await db.query("select public.inventory_create_trip($1,$2,$3,'Del jefe','2026-10-19',$4::uuid[])",[tenant,nextTrip,owner,[customer]]);
    await as(driver);
    await rejected(() => post('load',items(1),op(),nextTrip), /no asignado/);
    await post('load',items(5));
    await rejected(() => post('delivery',items(1),op(),trip,'40000000-0000-0000-0000-000000000002'), /no asignado/);
    await db.exec('reset role; set local role anon');
    await rejected(() => db.query('select * from public.inventory_trips'), /permission denied/);
    await rejected(() => post('receive',items(1)), /permission denied/);
  });

  it('cierra con aprobación del jefe, devuelve stock y habilita la siguiente carga', async () => {
    await post('receive',items(20)); await createTrip(); await createTrip(nextTrip);
    await as(driver); await post('load',items(10)); await post('delivery',items(3,1));
    await rejected(() => post('load',items(2),op(),nextTrip), /anterior/);
    await db.query('select public.inventory_submit_trip($1,$2)',[tenant,trip]);
    await rejected(() => post('delivery',items(1)), /no está activo/);
    await rejected(() => post('close',items(7)), /Solo el jefe/);
    await as(owner); await rejected(() => post('close',items(6)), /no coincide/);
    const close = op(); await post('close',items(7),close); await post('close',items(7),close);
    const stock = (await db.query('select * from public.inventory_truck_stock where trip_id=$1',[trip])).rows[0];
    expect(Number(stock.ready)).toBe(0); expect(Number(stock.empties)).toBe(0); expect(Number(stock.loaded)).toBe(10);
    expect(Number((await db.query('select ready from public.inventory_depot_stock')).rows[0].ready)).toBe(17);
    await as(driver); await post('load',items(5),op(),nextTrip);
    await rejected(() => post('load',items(1)), /Carga ya confirmada/);
  });

  it('permite regreso sin llenos y un cierre sin remanentes', async () => {
    await post('receive',items(5)); await createTrip(); await as(driver);
    await post('load',items(5)); await post('delivery',items(5,1));
    await db.query('select public.inventory_submit_trip($1,$2)',[tenant,trip]); await as(owner);
    await rejected(() => post('close',[]), /Faltan artículos/);
    await post('close',items(0));
    expect(Number((await db.query('select empties from public.inventory_depot_stock')).rows[0].empties)).toBe(1);
    await createTrip(nextTrip); await post('receive',items(1)); await as(driver);
    await post('load',items(1),op(),nextTrip); await post('delivery',items(1),op(),nextTrip);
    await db.query('select public.inventory_submit_trip($1,$2)',[tenant,nextTrip]); await as(owner);
    await post('close',[],op(),nextTrip);
    expect((await db.query('select status from public.inventory_trips where id=$1',[nextTrip])).rows[0].status).toBe('closed');
  });
  it('el parque propio se conserva entre cliente, camión, depósito y recarga', async () => {
    const ownerStock = (kind, quantity, id=op()) => db.query('select public.inventory_owner_stock($1,$2,$3,$4,$5::jsonb)',[tenant,id,kind,kind==='opening_customer'?customer:null,JSON.stringify(items(quantity))]);
    await post('receive',items(20));
    await ownerStock('receive_empty',5); const opening=op();
    await ownerStock('opening_customer',3,opening); await ownerStock('opening_customer',3,opening);
    await rejected(() => ownerStock('opening_customer',3), /apertura/);
    expect(Number((await db.query('select total_owned from public.inventory_owned_stock')).rows[0].total_owned)).toBe(28);
    await createTrip(); await as(driver); await post('load',items(10)); await post('delivery',items(4,3));
    await db.query('select public.inventory_submit_trip($1,$2)',[tenant,trip]); await as(owner); await post('close',items(6));
    const refill=op(); await ownerStock('refill',8,refill); await ownerStock('refill',8,refill);
    const balance=(await db.query('select * from public.inventory_owned_stock')).rows[0];
    expect(Number(balance.total_owned)).toBe(28); expect(Number(balance.depot_ready)).toBe(24);
    expect(Number(balance.in_customers)).toBe(4); expect(Number(balance.depot_empty)).toBe(0);
    await rejected(() => ownerStock('refill',1), /vacíos/);
    await as(driver); await rejected(() => ownerStock('refill',1), /Solo el jefe/);
    expect((await db.query('select * from public.inventory_owned_stock')).rows).toHaveLength(0);
  });
  it('registra dispenser gratis, alquilado o del cliente sin mezclar propiedad', async () => {
    const save=(id,operation,ownership,location,mode,monthly,customerId=location==='customer'?customer:null) => db.query('select public.inventory_save_dispenser($1,$2,$3,$4,$5,$6,$7,$8,null,$9,$10)',[tenant,operation,id,'Dispenser de prueba','',ownership,location,customerId,mode,monthly]);
    const asset='70000000-0000-0000-0000-000000000001', own='70000000-0000-0000-0000-000000000002';
    const first=op(); await save(asset,first,'company','depot',null,0); await save(asset,first,'company','depot',null,0);
    await save(asset,op(),'company','customer','loan',0);
    await save(own,op(),'customer','customer','customer_owned',0);
    expect((await db.query('select * from public.dispensers')).rows).toHaveLength(2);
    expect(Number((await db.query("select count(*) as n from public.dispensers where ownership='company'")).rows[0].n)).toBe(1);
    await save(asset,op(),'company','customer','rental',12000);
    await rejected(() => save(asset,op(),'company','customer','loan',10), /check constraint/);
    await rejected(() => save(asset,op(),'customer','customer','customer_owned',0), /propiedad/);
    await rejected(() => save(own,op(),'customer','customer',null,0), /check constraint/);
    await save(asset,op(),'company','depot',null,0);
    expect((await db.query('select * from public.dispenser_events')).rows).toHaveLength(5);
    await as(driver); expect((await db.query('select * from public.dispensers')).rows).toHaveLength(0);
    await rejected(() => save(asset,op(),'company','depot',null,0), /Solo el jefe/);
    await as(stranger); await rejected(() => save(asset,op(),'company','depot',null,0), /Solo el jefe/);
  });
  it('crea artículos sin duplicar por reintentos y valida precios y licencias', async () => {
    const id='30000000-0000-0000-0000-000000000003';
    const create=(price=3500) => db.query("select public.inventory_create_product($1,$2,'Bidón 12',$3,'unidad',true)",[tenant,id,price]);
    await create(); await create();
    const model='30000000-0000-0000-0000-000000000004';
    await db.query("select public.inventory_create_product($1,$2,'Dispenser básico',0,'unidad',false)",[tenant,model]);
    await db.query("update public.products set name='Modelo básico' where id=$1",[model]);
    expect((await db.query('select family from public.products where id=$1',[model])).rows[0].family).toBe('dispenser');
    await rejected(() => create(4000), /ya utilizado/);
    await rejected(() => create(3.555), /inválido/);
    await as(driver); await rejected(() => create(), /Solo el jefe/);
    await db.exec('reset role'); await db.exec(`update public.licenses set status='suspended' where tenant_id='${tenant}'`);
    await as(owner); await rejected(() => create(), /Solo el jefe/);
  });
  it('conserva fecha del hecho y fecha de registro y rechaza un reintento con otra fecha',async()=>{
    const id=op(),record=(date)=>db.query('select public.inventory_record_stock($1,$2,$3,null,null,$4::jsonb,$5,$6::date)',[tenant,id,'receive_empty',JSON.stringify(items(10)),'Apertura',date]);
    await record('2026-10-18');await record('2026-10-18');
    const {rows}=await db.query('select occurred_on::text,created_at from public.inventory_operations where id=$1',[id]);
    expect(rows[0].occurred_on).toBe('2026-10-18');expect(rows[0].created_at).toBeTruthy();
    expect(Number((await db.query('select depot_empty from public.inventory_owned_stock')).rows[0].depot_empty)).toBe(10);
    await rejected(()=>record('2026-10-17'),/otra fecha/);
  });
  it('descuenta roturas del cliente y conserva autor y persona involucrada, sin repetir la baja',async()=>{
    await db.query('select public.inventory_owner_stock($1,$2,$3,$4,$5::jsonb,$6)',[tenant,op(),'opening_customer',customer,JSON.stringify(items(3)),'Inicial']);
    const id=op(),remove=(quantity=1)=>db.query('select public.inventory_remove($1,$2,$3,$4,$5,$6,null,$7,$8::date,$9,$10,$11)',[tenant,id,'damage',product,quantity,'customer_held',customer,'2026-10-18','customer',customer,'Se cayó']);
    await remove();await remove();
    const event=(await db.query('select * from public.inventory_operations where id=$1',[id])).rows[0];
    expect(event.actor_id).toBe(owner);expect(event.involved_id).toBe(customer);expect(event.involved_kind).toBe('customer');
    expect(Number((await db.query('select in_customers,total_owned from public.inventory_owned_stock')).rows[0].in_customers)).toBe(2);
    await rejected(()=>remove(2),/otros datos/);
    await rejected(()=>db.query('select public.inventory_remove($1,$2,$3,$4,5,$5,null,null,$6::date,$7,$8,$9)',[tenant,op(),'damage',product,'depot_empty','2026-10-18','driver',driver,'Rotura']),/suficientes/);
    await as(driver);await rejected(()=>remove(),/Solo el jefe/);
  });
  it('registra bajas del camión sin alterar el depósito y aísla personas de otras empresas',async()=>{
    await post('receive',items(10));await createTrip();await post('load',items(4));
    const remove=(person=driver)=>db.query('select public.inventory_remove($1,$2,$3,$4,1,$5,$6,null,$7::date,$8,$9,$10)',[tenant,op(),'damage',product,'truck_ready',trip,'2026-10-18','driver',person,'Rotura en viaje']);
    await remove();
    const b=(await db.query('select * from public.inventory_owned_stock')).rows[0];
    expect(Number(b.depot_ready)).toBe(6);expect(Number(b.truck_ready)).toBe(3);expect(Number(b.total_owned)).toBe(9);
    await rejected(()=>remove(stranger),/Usuario no válido/);
    await as(stranger);await rejected(()=>remove(),/Solo el jefe/);
  });
  it('da de baja un dispenser identificado con auditoría y evita volver a asignarlo',async()=>{
    const asset='70000000-0000-0000-0000-000000000009';
    const save=()=>db.query("select public.inventory_save_dispenser($1,$2,$3,'Frío calor','FC-9','company','depot',null,null,null,0)",[tenant,op(),asset]);
    await save();const id=op();
    const retire=()=>db.query('select public.inventory_retire_dispenser($1,$2,$3,$4::date,$5,$6,$7)',[tenant,id,asset,'2026-10-18','owner',owner,'Se rompió']);
    await retire();await retire();
    expect((await db.query('select retired from public.dispensers where id=$1',[asset])).rows[0].retired).toBe(true);
    expect((await db.query('select incident from public.dispenser_events where id=$1',[id])).rows[0].incident).toMatchObject({kind:'damage',involved_kind:'owner',involved_id:owner});
    await rejected(()=>save(),/dado de baja/);
  });
  it('el stock de modelos queda disponible, asignar lo ocupa y devolver lo libera sin duplicar unidades',async()=>{
    const model='30000000-0000-0000-0000-000000000005',assignment=op();
    await db.query("select public.inventory_create_product($1,$2,'Dispenser básico',0,'unidad',false)",[tenant,model]);
    await post('receive',[{product_id:model,quantity:2}]);
    const assign=(id=assignment)=>db.query('select public.inventory_assign_dispenser_model($1,$2,$3,$4,$5,0,$6::date,null)',[tenant,id,model,customer,'loan','2026-10-18']);
    await assign();await assign();
    let b=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[model])).rows[0];
    expect([Number(b.total_owned),Number(b.depot_ready),Number(b.in_customers)]).toEqual([2,1,1]);
    const second=op();await assign(second);await rejected(()=>assign(op()),/No quedan dispenser/);
    const returned=op(),back=()=>db.query('select public.inventory_return_dispenser_model($1,$2,$3,$4::date)',[tenant,returned,assignment,'2026-10-19']);
    await back();await back();
    b=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[model])).rows[0];
    expect([Number(b.total_owned),Number(b.depot_ready),Number(b.in_customers)]).toEqual([2,1,1]);
    expect((await db.query('select status from public.dispenser_assignments where id=$1',[assignment])).rows[0].status).toBe('returned');
    await assign(op());
    expect((await db.query("select count(*)::int as n from public.dispenser_assignments where status='active'")).rows[0].n).toBe(2);
  });
  it('impide eliminar de activos un artículo con stock y conserva su historial después de la baja',async()=>{
    await post('receive',items(2));
    await rejected(()=>db.query('update public.products set active=false where id=$1',[product]),/unidades activas/);
    await db.query("select public.inventory_remove($1,$2,'remove',$3,2,'depot_ready',null,null,'2026-10-19','owner',$4,'Retiro de unidades')",[tenant,op(),product,owner]);
    await db.query('update public.products set active=false where id=$1',[product]);
    expect((await db.query('select active from public.products where id=$1',[product])).rows[0].active).toBe(false);
    expect((await db.query('select count(*)::int as n from public.inventory_movements where product_id=$1',[product])).rows[0].n).toBe(2);
  });
  it('reinicia solo el inventario de la empresa verificada conservando clientes, cuentas y otra empresa',async()=>{
    await post('receive',items(2));
    const otherProduct='30000000-0000-0000-0000-000000000099';
    await db.exec('reset role');
    await db.query("insert into public.products(id,tenant_id,name,price) values($1,$2,'Otro artículo',0)",[otherProduct,other]);
    await as(stranger);await db.query("select public.inventory_post($1,$2,'receive',null,null,$3::jsonb,'Compra ajena')",[other,op(),JSON.stringify([{product_id:otherProduct,quantity:3}])]);
    await db.exec('reset role');
    const before=(await db.query('select (select count(*)::int from auth.users) as users,(select count(*)::int from public.customers) as customers,(select count(*)::int from public.licenses) as licenses')).rows[0];
    await db.query("select set_config('hidrotrack.reset_tenant',$1,true)",[tenant]);
    await db.exec(await readFile(new URL('../supabase/maintenance/reset_inventory.sql',import.meta.url),'utf8'));
    expect((await db.query('select count(*)::int as n from public.products where tenant_id=$1',[tenant])).rows[0].n).toBe(0);
    expect((await db.query('select count(*)::int as n from public.inventory_movements where tenant_id=$1',[tenant])).rows[0].n).toBe(0);
    expect((await db.query('select count(*)::int as n from public.inventory_movements where tenant_id=$1',[other])).rows[0].n).toBe(1);
    const after=(await db.query('select (select count(*)::int from auth.users) as users,(select count(*)::int from public.customers) as customers,(select count(*)::int from public.licenses) as licenses')).rows[0];
    expect(after).toEqual(before);
  });
  it('rechaza reiniciar inventario sin empresa verificada o con reparto activo, sin borrar datos',async()=>{
    const reset=await readFile(new URL('../supabase/maintenance/reset_inventory.sql',import.meta.url),'utf8');
    await db.exec('reset role');await db.query("select set_config('hidrotrack.reset_tenant','',true)");
    await rejected(()=>db.exec(reset),/Falta empresa/);
    await as(owner);await post('receive',items(2));await createTrip();await post('load',items(1));
    await db.exec('reset role');await db.query("select set_config('hidrotrack.reset_tenant',$1,true)",[tenant]);
    await rejected(()=>db.exec(reset),/repartos activos/);
    expect((await db.query('select count(*)::int as n from public.inventory_movements where tenant_id=$1',[tenant])).rows[0].n).toBe(2);
  });
  it('una rotura en el cliente cierra la asignación y no vuelve a hacer disponible esa unidad',async()=>{
    const model='30000000-0000-0000-0000-000000000005',assignment=op();
    await db.query("select public.inventory_create_product($1,$2,'Dispenser frío calor',0,'unidad',false)",[tenant,model]);await post('receive',[{product_id:model,quantity:1}]);
    await db.query("select public.inventory_assign_dispenser_model($1,$2,$3,$4,'rental',5000,'2026-10-18',null)",[tenant,assignment,model,customer]);
    const damage=op(),breakIt=(date='2026-10-19')=>db.query('select public.inventory_remove($1,$2,$3,$4,1,$5,null,$6,$7::date,$8,$9,$10)',[tenant,damage,'damage',model,'customer_held',customer,date,'customer',customer,'Rotura']);
    await rejected(()=>breakIt('2026-10-17'),/anterior a la entrega/);
    await breakIt();await breakIt();
    expect((await db.query('select status from public.dispenser_assignments where id=$1',[assignment])).rows[0].status).toBe('damaged');
    const b=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[model])).rows[0];
    expect([Number(b.total_owned),Number(b.depot_ready),Number(b.in_customers)]).toEqual([0,0,0]);
    await rejected(()=>db.query('select public.inventory_return_dispenser_model($1,$2,$3,$4::date)',[tenant,op(),assignment,'2026-10-19']),/no está activo/);
  });
  it('asigna desde el camión solo a un cliente del reparto y protege asignaciones de otras cuentas',async()=>{
    const model='30000000-0000-0000-0000-000000000005';
    await db.query("select public.inventory_create_product($1,$2,'Dispenser básico',0,'unidad',false)",[tenant,model]);await post('receive',[{product_id:model,quantity:3}]);await createTrip();await post('load',[{product_id:model,quantity:2}]);
    const assign=()=>db.query("select public.inventory_assign_dispenser_model($1,$2,$3,$4,'loan',0,'2026-10-19',$5)",[tenant,op(),model,customer,trip]);await assign();
    const b=(await db.query('select * from public.inventory_owned_stock where product_id=$1',[model])).rows[0];
    expect([Number(b.total_owned),Number(b.depot_ready),Number(b.truck_ready),Number(b.in_customers)]).toEqual([3,1,1,1]);
    await as(driver);await rejected(()=>assign(),/Solo el jefe/);expect((await db.query('select * from public.dispenser_assignments')).rows).toHaveLength(0);
    await as(stranger);await rejected(()=>assign(),/Solo el jefe/);expect((await db.query('select * from public.dispenser_assignments')).rows).toHaveLength(0);
    expect((await db.query("select has_function_privilege('anon','public.inventory_assign_dispenser_model(uuid,uuid,uuid,uuid,text,numeric,date,uuid)','execute') as allowed")).rows[0].allowed).toBe(false);
  });
});
