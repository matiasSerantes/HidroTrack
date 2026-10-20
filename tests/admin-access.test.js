import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest';
const db = new PGlite();
const admin='00000000-0000-0000-0000-000000000001', owner='00000000-0000-0000-0000-000000000002', driver='00000000-0000-0000-0000-000000000003', second='00000000-0000-0000-0000-000000000004';
const tenant='10000000-0000-0000-0000-000000000001', other='10000000-0000-0000-0000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon;`);
 for(const version of ['20261017193404_foundation','20261017222129_admin_portal','20261020010000_admin_member_access']) await db.exec(await readFile(new URL(`../supabase/migrations/${version}.sql`,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
beforeEach(async()=>{
 await db.exec(`begin; insert into auth.users(id) values('${admin}'),('${owner}'),('${driver}'),('${second}'); insert into public.platform_admins values('${admin}'); insert into public.tenants(id,name) values('${tenant}','A'),('${other}','B'); insert into public.licenses(tenant_id,kind,status,driver_limit) values('${tenant}','permanent','active',1),('${other}','permanent','active',1); insert into public.tenant_members(tenant_id,user_id,role,active) values('${tenant}','${owner}','owner',true),('${tenant}','${driver}','driver',true),('${tenant}','${second}','driver',false),('${other}','${driver}','driver',true);`);
});
afterEach(async()=>{await db.exec('rollback; reset role');});
const as=async(user)=>{await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true)`);};
const set=(user,active,target=tenant)=>db.query('select public.admin_set_driver_access($1,$2,$3) as active',[target,user,active]);
const rejected=async(action,pattern)=>{
 await db.exec('savepoint failure');
 try { await expect(action()).rejects.toThrow(pattern); } finally { await db.exec('rollback to savepoint failure; release savepoint failure'); }
};
it('pausa solo la membresía elegida, conserva cuenta y registra autor sin duplicar reintentos',async()=>{
 await as(admin); await set(driver,false); await set(driver,false);
 const events=await db.query('select actor_id,was_active,is_active from public.admin_member_events');
 expect(events.rows).toEqual([{actor_id:admin,was_active:true,is_active:false}]);
 await db.exec('reset role');
 expect((await db.query('select active from public.tenant_members where tenant_id=$1 and user_id=$2',[other,driver])).rows[0].active).toBe(true);
 expect((await db.query('select count(*)::int as n from auth.users')).rows[0].n).toBe(4);
});
it('reactivación exige cupo y licencia vigente, pero permite pausar con licencia suspendida',async()=>{
 await as(admin); await rejected(()=>set(second,true),/límite/);
 await set(driver,false); await set(second,true);
 await db.exec(`reset role; update public.licenses set status='suspended' where tenant_id='${tenant}'`);
 await as(admin); await set(second,false); await rejected(()=>set(driver,true),/licencia vigente/);
});
it('rechaza titular, membresía de otra empresa y acceso de no administradores',async()=>{
 await as(admin); await rejected(()=>set(owner,false),/chofer/); await rejected(()=>set(second,false,other),/chofer/);
 await set(driver,false);
 await as(owner); await rejected(()=>set(driver,false),/Acceso denegado/);
 expect((await db.query('select * from public.admin_member_events')).rows).toEqual([]);
 await rejected(()=>db.query('update public.tenant_members set active=false'),/permission denied/);
 expect((await db.query("select has_function_privilege('anon','public.admin_set_driver_access(uuid,uuid,boolean)','execute') as allowed")).rows[0].allowed).toBe(false);
 await db.exec('set local role anon'); await rejected(()=>set(driver,false),/permission denied/);
});
it('rechaza licencia vencida y estado nulo sin generar eventos',async()=>{
 await db.exec(`update public.licenses set kind='monthly',expires_at=now()-interval '1 day' where tenant_id='${tenant}'`);
 await as(admin); await rejected(()=>set(second,true),/licencia vigente/); await rejected(()=>set(driver,null),/Estado inválido/);
 expect((await db.query('select * from public.admin_member_events')).rows).toEqual([]);
});
