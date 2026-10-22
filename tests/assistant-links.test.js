import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
const db=new PGlite();
const owner='00000000-0000-0000-0000-000000000001',otherOwner='00000000-0000-0000-0000-000000000002',driver='00000000-0000-0000-0000-000000000003',second='00000000-0000-0000-0000-000000000004',unconfirmed='00000000-0000-0000-0000-000000000005';
const tenant='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
async function actor(id){await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',true); set local role authenticated;`);}
async function link(t,u,active=true,request=crypto.randomUUID()){return db.query('select public.owner_set_assistant_link($1,$2,$3,$4) as id',[t,`HT-${u}`,active,request]);}
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
it('propuesta pendiente bloquea acceso por asignacion antigua y conserva nombres de jefes',async()=>{
 const pending=await readFile(new URL('../supabase/pending/assistant_waiting_access.sql',import.meta.url),'utf8');
 await db.exec(pending.replace(/^begin;\s*/,'').replace(/commit;\s*$/,''));
 await actor(owner);await link(tenant,driver);await db.exec('reset role');
 await db.exec(`insert into public.inventory_trips(tenant_id,driver_id,name,service_date) values('${tenant}','${driver}','Asignacion antigua',current_date)`);
 await actor(driver);
 expect((await db.query('select * from public.inventory_trips')).rows).toHaveLength(0);
 expect((await db.query('select * from public.customers')).rows).toHaveLength(0);
 expect((await db.query('select public.assistant_my_chiefs() as chiefs')).rows[0].chiefs).toHaveLength(1);
});
