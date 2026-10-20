import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = ts.transpileModule(readFileSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture({ admin = true, provisionError = null, cleanupError = null } = {}) {
 const server = {
  auth: { getUser: vi.fn(async token => token === 'valid-session' ? { data: { user: { id: 'admin-id' } } } : { data: {}, error: {} }), admin: {
   createUser: vi.fn(async () => ({ data: { user: { id: 'new-user' } } })),
   deleteUser: vi.fn(async () => ({ error: cleanupError })),
  } },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: admin ? { user_id: 'admin-id' } : null }) }) }) }),
  rpc: vi.fn(async () => ({ data: 'new-tenant', error: provisionError })),
 };
 let handler;
 runInNewContext(source, { exports: {}, require: () => ({ createClient: () => server }), Deno: { env: { get: () => 'server-only' }, serve: fn => { handler = fn; } }, Response });
 const call = (token = 'valid-session', body = { email: 'owner@example.test', password: 'long-password-123', role: 'owner', name: 'Test', kind: 'permanent', driver_limit: 2 }) => handler(new Request('https://example.test', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }));
 return { server, call };
}
it.each(['', 'invalid-session'])('rechaza una sesión ausente o inválida', async token => {
 const { server, call } = fixture();
 expect((await call(token)).status).toBe(401);
 expect(server.auth.admin.createUser).not.toHaveBeenCalled();
});
it('rechaza usuarios que no sean superadministradores', async () => {
 const { server, call } = fixture({ admin: false });
 expect((await call()).status).toBe(403);
 expect(server.auth.admin.createUser).not.toHaveBeenCalled();
});
it('deriva el actor de la sesión verificada y no del cuerpo', async () => {
 const { server, call } = fixture();
 expect((await call()).status).toBe(200);
 expect(server.rpc).toHaveBeenCalledWith('admin_provision', expect.objectContaining({ p_actor: 'admin-id', p_user: 'new-user', p_role: 'owner', p_limit: 2 }));
});
it('elimina el usuario recién creado si falla su asignación', async () => {
 const { server, call } = fixture({ provisionError: {} });
 expect((await call()).status).toBe(400);
 expect(server.auth.admin.deleteUser).toHaveBeenCalledWith('new-user');
});
it('explica un alta incompleta si la compensación también falla', async () => {
 const { call } = fixture({ provisionError: {}, cleanupError: {} });
 const response = await call();
 expect(response.status).toBe(500);
 expect((await response.json()).error).toMatch(/incompleta/);
});
