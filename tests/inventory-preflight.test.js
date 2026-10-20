import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('diagnostica componentes ausentes o parciales dentro de una transacción de solo lectura', async () => {
 const db = new PGlite();
 try {
  const sql = await readFile(new URL('../supabase/tests/inventory_preflight.sql', import.meta.url), 'utf8');
  await db.exec('begin read only');
  const absent = await db.query(sql);
  expect(absent.rows.map(row => row.component_status)).toEqual(['absent', 'absent', 'absent']);
  await db.exec('rollback; create table public.dispenser_assignments(id uuid); begin read only');
  const partial = await db.query(sql);
  expect(partial.rows[1]).toMatchObject({ version: '20261019190000', component_status: 'partial', missing_components: ['inventory_assign_dispenser_model', 'inventory_return_dispenser_model'] });
  await db.exec('rollback');
 } finally { await db.close(); }
});
