import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (req: Request) => {
 if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
 if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' });
 try {
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'Iniciá sesión nuevamente.' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const server = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await server.auth.getUser(authorization.slice(7));
  if (authError || !identity.user) return reply(401, { error: 'Sesión inválida.' });
  const { data: admin, error: adminError } = await server.from('platform_admins').select('user_id').eq('user_id', identity.user.id).maybeSingle();
  if (adminError || !admin) return reply(403, { error: 'Acceso reservado al superadministrador.' });
  const body = await req.json();
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128) return reply(400, { error: 'Ingresá un correo válido y una contraseña de 12 a 128 caracteres.' });
  if (!['owner','driver'].includes(body.role)) return reply(400, { error: 'Rol inválido.' });
  if (body.role === 'owner' && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120 || !['permanent','monthly'].includes(body.kind) || !Number.isSafeInteger(body.driver_limit) || body.driver_limit < 0 || body.driver_limit > 10000 || (body.kind === 'monthly' && (!body.expires_at || !Number.isFinite(Date.parse(body.expires_at)) || Date.parse(body.expires_at) <= Date.now())))) return reply(400, { error: 'Revisá el nombre, la licencia, el vencimiento y el límite de choferes.' });
  if (body.role === 'driver' && (typeof body.tenant_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.tenant_id))) return reply(400, { error: 'Seleccioná una sodería.' });
  const { data: created, error: createError } = await server.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) return reply(400, { error: 'No se pudo crear el usuario. Revisá la contraseña y que el correo no esté registrado.' });
  const { data: tenantId, error: provisionError } = await server.rpc('admin_provision', {
   p_actor: identity.user.id, p_user: created.user.id, p_name: body.role === 'owner' ? body.name.trim() : null,
   p_tenant: body.role === 'driver' ? body.tenant_id : null, p_role: body.role,
   p_kind: body.role === 'owner' ? body.kind : null,
   p_expires: body.role === 'owner' && body.kind === 'monthly' ? body.expires_at : null,
   p_limit: body.role === 'owner' ? body.driver_limit : null,
  });
  if (provisionError) {
   const { error: cleanupError } = await server.auth.admin.deleteUser(created.user.id);
   if (cleanupError) return reply(500, { error: 'El alta quedó incompleta. Revisá el usuario en Authentication antes de reintentar.' });
   return reply(400, { error: 'No se pudo asignar el usuario. Revisá la licencia y el límite de choferes.' });
  }
  return reply(200, { user_id: created.user.id, tenant_id: tenantId });
 } catch { return reply(500, { error: 'No se pudo completar la solicitud. Actualizá el panel antes de reintentar.' }); }
});
