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
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
  `);
  for (const name of ['20261017193404_foundation', '20261017222129_admin_portal', '20261019160747_inventory', '20261019162655_owned_inventory']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
}, 30000);
afterAll(async () => { await db.close(); });
describe('migración y seguridad PostgreSQL', () => {
  it('activa RLS en todas las tablas comerciales y administrativas', async () => {
    const { rows } = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`);
    expect(rows).toHaveLength(15);
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
  it('registra surtidor gratis, alquilado o del cliente sin mezclar propiedad', async () => {
    const save=(id,operation,ownership,location,mode,monthly,customerId=location==='customer'?customer:null) => db.query('select public.inventory_save_dispenser($1,$2,$3,$4,$5,$6,$7,$8,null,$9,$10)',[tenant,operation,id,'Surtidor de prueba','',ownership,location,customerId,mode,monthly]);
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
    await rejected(() => create(4000), /ya utilizado/);
    await rejected(() => create(3.555), /inválido/);
    await as(driver); await rejected(() => create(), /Solo el jefe/);
    await db.exec('reset role'); await db.exec(`update public.licenses set status='suspended' where tenant_id='${tenant}'`);
    await as(owner); await rejected(() => create(), /Solo el jefe/);
  });
});
