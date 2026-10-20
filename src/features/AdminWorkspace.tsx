import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Droplets, LogOut, Plus, RefreshCw } from 'lucide-react';
import './OwnerWorkspace.css';
import { addDemoUser, initialAdminDemo, readAdminDemo, saveAdminDemo, type AdminLicense as License, type AdminTenant as Tenant } from '../domain/adminDemo';

function licenseFields(data: FormData) {
 const kind = String(data.get('kind'));
 const date = String(data.get('expires_at') ?? '');
 return { kind, status: String(data.get('status') ?? 'active'), driver_limit: Number(data.get('driver_limit')), expires_at: kind === 'monthly' && date ? new Date(`${date}T23:59:59-03:00`).toISOString() : null };
}
function LicenseFields({ license, disabled }: { license?: License | null; disabled: boolean }) {
 const [kind, setKind] = useState(license?.kind ?? 'permanent');
 return <><label>Tipo de licencia<select name="kind" value={kind} onChange={e => setKind(e.target.value)} disabled={disabled}><option value="permanent">Permanente</option><option value="monthly">Mensual</option></select></label>{kind === 'monthly' && <label>Vigente hasta (Argentina)<input name="expires_at" type="date" required defaultValue={license?.expires_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(license.expires_at)) : ''} disabled={disabled}/></label>}<label>Límite de choferes<input name="driver_limit" type="number" min="0" max="10000" required defaultValue={license?.driver_limit ?? 0} disabled={disabled}/></label></>;
}
export function AdminWorkspace({ client, demo = false, onExit }: { client?: SupabaseClient; demo?: boolean; onExit?: () => void }) {
 const [tenants, setTenants] = useState<Tenant[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const [busy, setBusy] = useState(false);
 const [refresh, setRefresh] = useState(0);
 const [form, setForm] = useState<'owner' | 'driver' | null>(null);
 const [editing, setEditing] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 useEffect(() => {
  let active = true; setLoading(true); setError('');
  if (demo) { setTenants(readAdminDemo()); setLoading(false); return; }
  if (!client) { setError('No hay una conexión configurada.'); setLoading(false); return; }
  void client.rpc('admin_directory').then(({ data, error }) => {
   if (active) { if (error) setError('No pudimos cargar las soderías. Reintentá la consulta.'); else setTenants(data ?? []); setLoading(false); }
  }, () => { if (active) { setError('No pudimos conectar con el servidor.'); setLoading(false); } });
  return () => { active = false; };
 }, [client, refresh, demo]);
 function saveDemo(next: Tenant[]) { saveAdminDemo(next); setTenants(next); }
 async function createUser(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (busy || !form) return;
  const data = new FormData(event.currentTarget);
  setBusy(true); setNotice('');
  try {
   const body = { role: form, email: String(data.get('email')).trim(), password: String(data.get('password')), name: String(data.get('name') ?? '').trim(), tenant_id: data.get('tenant_id'), ...licenseFields(data) };
   if (demo) {
    if (body.password.length < 12) throw new Error('La contraseña de ejemplo debe tener al menos 12 caracteres.');
    saveDemo(addDemoUser(tenants, body)); setForm(null); setNotice('Alta simulada guardada en este navegador. No se creó una cuenta real ni se guardó la contraseña.'); return;
   }
   if (!client) throw new Error('No hay una conexión configurada.');
   const result = await client.functions.invoke('admin-users', { body });
   if (result.error) {
    let message = 'No se pudo completar el alta. Actualizá la lista antes de reintentar.';
    try { const detail = await result.error.context?.json(); if (detail?.error) message = detail.error; } catch { /* La respuesta puede no ser JSON. */ }
    throw new Error(message);
   }
   setForm(null); setNotice('Alta completada. El usuario ya puede ingresar con el correo y la contraseña indicados.'); setRefresh(v => v + 1);
  } catch (err) { setNotice(err instanceof Error ? err.message : 'No se pudo completar el alta.'); }
  finally { setBusy(false); }
 }
 async function saveLicense(event: FormEvent<HTMLFormElement>, tenant: Tenant) {
  event.preventDefault(); if (busy) return;
  const values = licenseFields(new FormData(event.currentTarget));
  if (values.kind === 'monthly' && !values.expires_at) { setNotice('Completá el vencimiento.'); return; }
  if (values.driver_limit < tenant.members.filter(m => m.active && m.role === 'driver').length) { setNotice('El límite no puede ser menor que la cantidad de choferes activos.'); return; }
  setBusy(true); setNotice('');
  try {
   if (demo) { saveDemo(tenants.map(t => t.id === tenant.id ? { ...t, license: values } : t)); setEditing(null); setNotice('Licencia de demostración actualizada.'); return; }
   if (!client) throw new Error('Sin conexión');
   const result = await client.from('licenses').update(values).eq('tenant_id', tenant.id).select('tenant_id').single();
   if (result.error) throw result.error;
   setEditing(null); setNotice('Licencia actualizada.'); setRefresh(v => v + 1);
  } catch { setNotice('No se pudo actualizar la licencia. Revisá la conexión y tus permisos.'); }
  finally { setBusy(false); }
 }
 async function signOut() {
  if (demo) { onExit?.(); return; }
  if (!client) return;
  setBusy(true);
  try { const { error } = await client.auth.signOut(); if (error) throw error; }
  catch { setNotice('No pudimos cerrar la sesión. Reintentá.'); setBusy(false); }
 }
 return <main className="connected-workspace"><header><div><span className="eyebrow">HIDROTRACK · ADMINISTRACIÓN</span><h1><Droplets size={26}/> Panel del superadministrador</h1><p className="muted">Administrá soderías, cuentas y licencias.</p></div><button onClick={signOut} disabled={busy}><LogOut size={16}/> Cerrar sesión</button></header>
 {demo && <div className="demo-notice"><span><strong>Modo demostración</strong> · Datos ficticios guardados solo en este navegador. Las cuentas y contraseñas son de ejemplo.</span><button disabled={busy} onClick={() => { if (confirm('¿Restablecer las soderías y usuarios de demostración?')) { try { saveDemo(initialAdminDemo()); setForm(null); setEditing(null); setNotice('Demostración restablecida.'); } catch { setNotice('No se pudo guardar en este navegador.'); } } }}>Restablecer demo</button></div>}
 <div className="stats">{[['Soderías', tenants.length], ['Titulares', tenants.reduce((n, t) => n + t.members.filter(m => m.role === 'owner').length, 0)], ['Choferes activos', tenants.reduce((n, t) => n + t.members.filter(m => m.role === 'driver' && m.active).length, 0)], ['Licencias suspendidas', tenants.filter(t => t.license?.status === 'suspended').length]].map(([label, value]) => <article className="stat" key={label}><span className="muted">{label}</span><strong>{loading ? '…' : value}</strong></article>)}</div>
 <div className="admin-actions"><button className="primary" disabled={busy} onClick={() => { setForm('owner'); setNotice(''); }}><Plus size={16}/> Nueva sodería</button><button className="secondary" disabled={busy || loading || !!error || !tenants.length} onClick={() => { setForm('driver'); setNotice(''); }}><Plus size={16}/> Nuevo chofer</button><button disabled={busy || loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16}/> Actualizar</button></div>
 {notice && <p className="notice" role="status">{notice}</p>}
 {form && <section className="panel"><h2>{form === 'owner' ? 'Nueva sodería y titular' : 'Nuevo chofer'}</h2><p className="muted">La contraseña debe tener al menos 12 caracteres. Compartila con el usuario por un medio privado.</p><form className="customer-form" onSubmit={createUser} key={form}>
 {form === 'owner' ? <label>Nombre de la sodería<input name="name" required maxLength={120} disabled={busy} autoFocus/></label> : <label>Sodería<select name="tenant_id" required disabled={busy}>{tenants.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>}
 <label>Correo del {form === 'owner' ? 'titular' : 'chofer'}<input name="email" type="email" required maxLength={254} disabled={busy} autoComplete="off"/></label><label>Contraseña inicial<input name="password" type="password" required minLength={12} maxLength={128} disabled={busy} autoComplete="new-password"/></label>
 {form === 'owner' && <LicenseFields disabled={busy}/>}
 <button className="primary" disabled={busy}>{busy ? 'Creando…' : 'Confirmar alta'}</button><button type="button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button></form></section>}
 {loading ? <p role="status">Cargando soderías…</p> : error ? <p className="notice" role="alert">{error}</p> : <section className="panel"><div className="section-heading"><h2>Soderías registradas</h2><span className="badge">{tenants.length} soderías</span></div><label>Buscar soderías<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o correo del usuario"/></label>
 {tenants.filter(t => `${t.name} ${t.members.map(m => m.email).join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(t => <article className="admin-tenant" key={t.id}><div className="section-heading"><div><h3>{t.name}</h3><p className="muted">{t.license ? `${t.license.kind === 'permanent' ? 'Permanente' : 'Mensual'} · ${t.license.status === 'suspended' ? 'Suspendida' : t.license.expires_at && Date.parse(t.license.expires_at) <= Date.now() ? 'Vencida' : 'Activa'}` : 'Sin licencia'} · {t.members.filter(m => m.role === 'driver' && m.active).length} / {t.license?.driver_limit ?? 0} choferes</p>{t.license?.expires_at && <small>Vencimiento: {new Date(t.license.expires_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</small>}</div><button disabled={busy || !t.license} onClick={() => setEditing(editing === t.id ? null : t.id)}>Editar licencia</button></div>
 <div className="table-wrap"><table><thead><tr><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{t.members.map(m => <tr key={m.user_id}><td>{m.email}</td><td>{m.role === 'owner' ? 'Titular' : 'Chofer'}</td><td>{m.active ? 'Activo' : 'Inactivo'}</td></tr>)}</tbody></table></div>
 {editing === t.id && <form className="customer-form" onSubmit={e => void saveLicense(e, t)}><LicenseFields license={t.license} disabled={busy}/><label>Estado<select name="status" defaultValue={t.license?.status ?? 'active'} disabled={busy}><option value="active">Activa</option><option value="suspended">Suspendida</option></select></label><button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar licencia'}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></form>}</article>)}
 {!tenants.length && <p className="empty">Todavía no hay soderías. Creá la primera para comenzar.</p>}{!!tenants.length && !tenants.some(t => `${t.name} ${t.members.map(m => m.email).join(' ')}`.toLowerCase().includes(search.toLowerCase())) && <p className="empty">No encontramos soderías con esa búsqueda.</p>}</section>}
 </main>;
}
