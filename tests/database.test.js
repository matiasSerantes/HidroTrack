import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// PostgreSQL real en WASM; solo el contrato mínimo de Auth se prepara como fixture.
// No sustituye las pruebas de integración contra Supabase Auth/PostgREST.
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202610170001_foundation.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });
describe('migración y seguridad PostgreSQL', () => {
  it('activa RLS en todas las tablas comerciales y administrativas', async () => {
    const { rows } = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`);
    expect(rows).toHaveLength(9);
    expect(rows.every(row => row.relrowsecurity)).toBe(true);
  });
  it('ejecuta escenarios de aislamiento, roles, licencias y auditoría con rollback', async () => {
    const sql = await readFile(new URL('../supabase/tests/isolation.sql', import.meta.url), 'utf8');
    await db.exec(sql.replace(/^\\set.*$/gm, ''));
    expect((await db.query('select count(*)::int as count from public.tenants')).rows[0].count).toBe(0);
  });
});
