export type AdminLicense = { kind: string; status: string; expires_at: string | null; driver_limit: number; driver_plan?: string };
export type AdminTenant = { id: string; name: string; license: AdminLicense | null; members: { user_id: string; email: string; role: string; active: boolean }[] };
const storageKey = 'hidrotrack.admin-demo.v1';
export function initialAdminDemo(): AdminTenant[] {
 return [
  { id: 'demo-norte', name: 'Sodería del Norte', license: { kind: 'permanent', status: 'active', expires_at: null, driver_limit: 3 }, members: [{ user_id: 'owner-norte', email: 'titular.norte@example.com', role: 'owner', active: true }, { user_id: 'driver-norte', email: 'chofer.norte@example.com', role: 'driver', active: true }] },
  { id: 'demo-sur', name: 'Aguas del Sur', license: { kind: 'monthly', status: 'active', expires_at: new Date(Date.now() + 20 * 86400000).toISOString(), driver_limit: 2 }, members: [{ user_id: 'owner-sur', email: 'titular.sur@example.com', role: 'owner', active: true }] },
  { id: 'demo-centro', name: 'Soda Central', license: { kind: 'monthly', status: 'suspended', expires_at: new Date(Date.now() - 5 * 86400000).toISOString(), driver_limit: 1 }, members: [{ user_id: 'owner-centro', email: 'titular.centro@example.com', role: 'owner', active: true }] },
 ];
}
export function readAdminDemo(): AdminTenant[] {
 try {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
   const data = JSON.parse(raw);
   if (Array.isArray(data) && data.every(t => typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.members) && t.members.every((m: { email?: unknown }) => typeof m.email === 'string') && t.license && Number.isInteger(t.license.driver_limit))) return data;
  }
 } catch { /* Se recuperan los ejemplos si el almacenamiento no está disponible. */ }
 return initialAdminDemo();
}
export function saveAdminDemo(data: AdminTenant[]) { localStorage.setItem(storageKey, JSON.stringify(data)); }
export function setDemoDriverAccess(tenants: AdminTenant[], tenantId: string, userId: string, active: boolean): AdminTenant[] {
 const tenant = tenants.find(t => t.id === tenantId);
 const member = tenant?.members.find(m => m.user_id === userId);
 if (!tenant || !member || member.role !== 'driver') throw new Error('Seleccioná un chofer de esta empresa.');
 if (member.active === active) return tenants;
 if (active) {
  const license = tenant.license;
  if (!license || license.status !== 'active' || (license.kind === 'monthly' && (!license.expires_at || !Number.isFinite(Date.parse(license.expires_at)) || Date.parse(license.expires_at) <= Date.now()))) throw new Error('La empresa debe tener una licencia vigente.');
  if (license.driver_plan!=='unlimited' && tenant.members.filter(m => m.role === 'driver' && m.active).length >= license.driver_limit) throw new Error('Se alcanzó el límite de choferes.');
 }
 return tenants.map(t => t.id === tenantId ? { ...t, members: t.members.map(m => m.user_id === userId ? { ...m, active } : m) } : t);
}
export function addDemoUser(tenants: AdminTenant[], body: { role: string; email: string; name: string; tenant_id: unknown; kind: string; expires_at: string | null; driver_limit: number }): AdminTenant[] {
 const email = body.email.trim().toLowerCase();
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ingresá un correo válido.');
 if (tenants.some(t => t.members.some(m => m.email.toLowerCase() === email))) throw new Error('Ese correo ya existe en la demostración.');
 const user = { user_id: crypto.randomUUID(), email, role: body.role, active: true };
 if (body.role === 'owner') {
  if (!body.name.trim() || !Number.isSafeInteger(body.driver_limit) || body.driver_limit < 0 || (body.kind === 'monthly' && (!body.expires_at || Date.parse(body.expires_at) <= Date.now()))) throw new Error('Revisá el nombre, el límite y el vencimiento.');
  return [{ id: crypto.randomUUID(), name: body.name, license: { kind: body.kind, status: 'active', expires_at: body.expires_at, driver_limit: body.driver_limit }, members: [user] }, ...tenants];
 }
 const tenant = tenants.find(t => t.id === body.tenant_id);
 if (!tenant?.license || tenant.license.status !== 'active' || (tenant.license.kind === 'monthly' && (!tenant.license.expires_at || Date.parse(tenant.license.expires_at) <= Date.now()))) throw new Error('La sodería debe tener una licencia vigente.');
 if (tenant.license.driver_plan!=='unlimited' && tenant.members.filter(m => m.role === 'driver' && m.active).length >= tenant.license.driver_limit) throw new Error('Se alcanzó el límite de choferes de esta sodería.');
 return tenants.map(t => t.id === tenant.id ? { ...t, members: [...t.members, user] } : t);
}
