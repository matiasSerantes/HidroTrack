import {signOutWithPushCleanup} from '../lib/pushSession';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Droplets, LogOut, Plus, RefreshCw, LayoutDashboard, Users, ShieldCheck, Search } from 'lucide-react';
import './OwnerWorkspace.css';
import './AdminWorkspace.css';
import { AdminAccessHistory, type AccessEvent } from './AdminAccessHistory';
import { addDemoUser, initialAdminDemo, readAdminDemo, saveAdminDemo, setDemoDriverAccess, type AdminLicense as License, type AdminTenant as Tenant } from '../domain/adminDemo';

function licenseFields(data: FormData) {
 const kind = String(data.get('kind'));
 const date = String(data.get('expires_at') ?? '');
 return { ...(data.has('driver_plan')?{driver_plan:String(data.get('driver_plan'))}:{}), kind, status: String(data.get('status') ?? 'active'), driver_limit: Number(data.get('driver_limit')), expires_at: kind === 'monthly' && date ? new Date(`${date}T23:59:59-03:00`).toISOString() : null };
}
function LicenseFields({ license, disabled }: { license?: License | null; disabled: boolean }) {
 const [kind,setKind]=useState(license?.kind??'permanent');
 const [plan,setPlan]=useState(license?.driver_plan??'custom');
 return <><label>Tipo de licencia<select name="kind" value={kind} onChange={e=>setKind(e.target.value)} disabled={disabled}><option value="permanent">Permanente</option><option value="monthly">Mensual</option></select></label>
 {kind==='monthly'&&<label>Vigente hasta (Argentina)<input name="expires_at" type="date" required defaultValue={license?.expires_at?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(license.expires_at)):''} disabled={disabled}/></label>}
 {license&&<label>Plan de asistentes<select name="driver_plan" value={plan} onChange={e=>setPlan(e.target.value)} disabled={disabled}><option value="custom">Personalizado / licencia actual</option><option value="basic">Básico - 1 asistente</option><option value="intermediate">Intermedio - 3 asistentes</option><option value="unlimited">Superior - ilimitados</option></select></label>}
 {plan==='custom'?<label>Límite de choferes<input name="driver_limit" type="number" min="0" max="10000" required defaultValue={license?.driver_limit??0} disabled={disabled}/></label>:<><input type="hidden" name="driver_limit" value={plan==='basic'?1:plan==='intermediate'?3:0}/><p>Cupo: {plan==='unlimited'?'Ilimitado':plan==='basic'?1:3}</p></>}</>;
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
 const [view, setView] = useState<'overview' | 'users' | 'licenses'>('overview');
 const [roleFilter, setRoleFilter] = useState('all');
 const [accessFilter, setAccessFilter] = useState('all');
 const [showHistory,setShowHistory] = useState(false);
 const [demoEvents,setDemoEvents] = useState<AccessEvent[]>([]);
 function licenseState(tenant: Tenant) {
  const license = tenant.license;
  if (!license) return 'Sin licencia';
  if (license.status !== 'active') return 'Suspendida';
  if (license.kind === 'monthly' && (!license.expires_at || !Number.isFinite(Date.parse(license.expires_at)) || Date.parse(license.expires_at) <= Date.now())) return 'Vencida';
  return 'Activa';
 }
 const people = tenants.flatMap(tenant => tenant.members.map(member => ({ ...member, tenant, access: !member.active ? 'Inactivo' : licenseState(tenant) === 'Activa' ? 'Habilitado' : 'Bloqueado por licencia' })));
 const visiblePeople = people.filter(person => `${person.email} ${person.tenant.name}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')) && (roleFilter === 'all' || person.role === roleFilter) && (accessFilter === 'all' || person.access === accessFilter));
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
 async function changeDriverAccess(tenant: Tenant, member: Tenant['members'][number]) {
  if (busy || loading || member.role !== 'driver') return;
  const active = !member.active;
  if (!window.confirm(`${active ? '¿Reactivar' : '¿Pausar'} el acceso de ${member.email} en ${tenant.name}? Se conserva la cuenta y su historial. ${active ? 'Necesita licencia vigente y un cupo disponible.' : 'El cambio afecta únicamente a esta empresa; no cierra repartos ni rendiciones pendientes.'}`)) return;
  setBusy(true); setNotice('');
  try {
   if (demo) { saveDemo(setDemoDriverAccess(tenants, tenant.id, member.user_id, active)); setDemoEvents(events=>[{id:crypto.randomUUID(),tenant_name:tenant.name,user_email:member.email,actor_email:'Administrador de ejemplo',is_active:active,created_at:new Date().toISOString()},...events].slice(0,100)); setNotice('Acceso de demostración actualizado.'); return; }
   if (!client) throw new Error('Sin conexión');
   const result = await client.rpc('admin_set_driver_access', { p_tenant: tenant.id, p_user: member.user_id, p_active: active });
   if (result.error) {
    if (['PGRST202', '42883'].includes(result.error.code)) { setNotice('La gestión individual de accesos requiere una actualización del servidor. No se modificó el usuario.'); return; }
    throw result.error;
   }
   if (result.data !== active) throw new Error('Respuesta inesperada');
   setNotice('Acceso actualizado. Se conserva la cuenta y su historial.'); setRefresh(v => v + 1);
  } catch { setNotice('No pudimos confirmar el cambio de acceso. Revisá la licencia, el cupo y la conexión; actualizá la lista antes de reintentar.'); }
  finally { setBusy(false); }
 }
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
  if (values.driver_plan!=='unlimited' && values.driver_limit < tenant.members.filter(m => m.active && m.role === 'driver').length) { setNotice('El límite no puede ser menor que la cantidad de choferes activos.'); return; }
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
  try { const { error } = await signOutWithPushCleanup(client); if (error) throw error; }
  catch { setNotice('No pudimos cerrar la sesión. Reintentá.'); setBusy(false); }
 }
 return <div className="admin-shell"><aside className="admin-sidebar"><a className="admin-brand" href="/"><Droplets size={27}/> HidroTrack<span>ADMINISTRACIÓN</span></a><nav aria-label="Administración de plataforma">{([['overview','Resumen',LayoutDashboard],['users','Usuarios',Users],['licenses','Empresas y licencias',ShieldCheck]] as const).map(([id,label,Icon])=><button key={id} disabled={busy} aria-current={view===id?'page':undefined} onClick={()=>{setView(id);setSearch('');setForm(null);setEditing(null);}}><Icon size={19}/>{label}</button>)}</nav><p>Gestioná el acceso a la plataforma desde tu cuenta de administrador.</p></aside><main className="connected-workspace admin-workspace"><header><div><span className="eyebrow">HIDROTRACK · ADMINISTRACIÓN</span><h1>{view==='overview'?'Tu panel de administración':view==='users'?'Usuarios de la plataforma':'Empresas y licencias'}</h1><p className="muted">Administrá soderías, cuentas y licencias.</p></div><button onClick={signOut} disabled={busy}><LogOut size={16}/> {demo?'Salir de la vista previa':'Cerrar sesión'}</button></header>
 {demo && <div className="demo-notice"><span><strong>Modo demostración</strong> · Datos ficticios guardados solo en este navegador. Las cuentas y contraseñas son de ejemplo.</span><button disabled={busy} onClick={() => { if (confirm('¿Restablecer las soderías y usuarios de demostración?')) { try { saveDemo(initialAdminDemo());setDemoEvents([]); setForm(null); setEditing(null); setNotice('Demostración restablecida.'); } catch { setNotice('No se pudo guardar en este navegador.'); } } }}>Restablecer demo</button></div>}
 <div className="stats">{[['Soderías', tenants.length], ['Usuarios registrados', people.length], ['Accesos habilitados', people.filter(p=>p.access==='Habilitado').length], ['Empresas por revisar', tenants.filter(t=>licenseState(t)!=='Activa').length]].map(([label, value]) => <article className="stat" key={label}><span className="muted">{label}</span><strong>{loading || error ? '—' : value}</strong></article>)}</div>
 {view==='overview' && <section className="admin-welcome"><div><span className="eyebrow">TU PLATAFORMA, EN ORDEN</span><h2>Un lugar para gestionar a tu equipo de usuarios.</h2><p>Revisá quién tiene acceso, agregá titulares o choferes y mantené sus licencias al día.</p><button onClick={()=>{setView('users');setSearch('');}}>Ver usuarios <Users size={17}/></button></div><ShieldCheck size={76} aria-hidden="true"/></section>}
 <div className="admin-actions"><button className="primary" disabled={busy} onClick={() => { setForm('owner'); setNotice(''); }}><Plus size={16}/> Nueva sodería</button><button className="secondary" disabled={busy || loading || !!error || !tenants.length} onClick={() => { setForm('driver'); setNotice(''); }}><Plus size={16}/> Nuevo chofer</button><button disabled={busy || loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16}/> Actualizar</button><button disabled={busy} aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Ocultar historial':'Ver historial de accesos'}</button></div>
 {showHistory&&<AdminAccessHistory client={client} demo={demo} events={demoEvents} revision={refresh}/>}
 {notice && <p className="notice" role="status">{notice}</p>}
 {form && <section className="panel"><h2>{form === 'owner' ? 'Nueva sodería y titular' : 'Nuevo chofer'}</h2><p className="muted">La contraseña debe tener al menos 12 caracteres. Compartila con el usuario por un medio privado.</p><form className="customer-form" onSubmit={createUser} key={form}>
 {form === 'owner' ? <label>Nombre de la sodería<input name="name" required maxLength={120} disabled={busy} autoFocus/></label> : <label>Sodería<select name="tenant_id" required disabled={busy}>{tenants.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>}
 <label>Correo del {form === 'owner' ? 'titular' : 'chofer'}<input name="email" type="email" required maxLength={254} disabled={busy} autoComplete="off"/></label><label>Contraseña inicial<input name="password" type="password" required minLength={12} maxLength={128} disabled={busy} autoComplete="new-password"/></label>
 {form === 'owner' && <LicenseFields disabled={busy}/>}
 <button className="primary" disabled={busy}>{busy ? 'Creando…' : 'Confirmar alta'}</button><button type="button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button></form></section>}
 {loading ? <p role="status">Cargando soderías…</p> : error ? <p className="notice" role="alert">{error}</p> : view==='users' ? <section className="panel"><div className="section-heading"><h2>Directorio de usuarios</h2><span className="badge">{visiblePeople.length} de {people.length}</span></div><div className="admin-filters"><label>Buscar usuarios<span className="admin-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Correo o empresa" type="search"/></span></label><label>Rol<select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">Todos los roles</option><option value="owner">Titulares</option><option value="driver">Choferes</option></select></label><label>Acceso<select value={accessFilter} onChange={e=>setAccessFilter(e.target.value)}><option value="all">Todos los accesos</option><option>Habilitado</option><option>Inactivo</option><option>Bloqueado por licencia</option></select></label></div><p className="admin-help">El acceso indicado depende de la membresía y la licencia; no indica quién está conectado ahora.</p><div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Empresa</th><th>Rol</th><th>Acceso</th><th>Gestión</th></tr></thead><tbody>{visiblePeople.map(person=><tr key={`${person.tenant.id}-${person.user_id}`}><td data-label="Usuario">{person.email}</td><td data-label="Empresa">{person.tenant.name}</td><td data-label="Rol">{person.role==='owner'?'Titular':'Chofer'}</td><td data-label="Acceso"><span className={`admin-status ${person.access==='Habilitado'?'enabled':'restricted'}`}>{person.access}</span></td><td data-label="Gestión">{person.role==='driver'&&<button disabled={busy||loading} aria-label={`${person.active?'Pausar':'Reactivar'} acceso de ${person.email}`} onClick={()=>void changeDriverAccess(person.tenant,person)}>{person.active?'Pausar acceso':'Reactivar acceso'}</button>}<button disabled={busy} aria-label={`Ver empresa de ${person.email}`} onClick={()=>{setView('licenses');setSearch(person.tenant.name);}}>Ver empresa</button></td></tr>)}</tbody></table></div>{!visiblePeople.length&&<p className="empty">{people.length?'No encontramos usuarios con esos filtros.':'Todavía no hay usuarios registrados.'}</p>}</section> : <section className="panel"><div className="section-heading"><h2>Soderías registradas</h2><span className="badge">{tenants.length} soderías</span></div><label>Buscar soderías<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o correo del usuario"/></label>
 {tenants.filter(t => `${t.name} ${t.members.map(m => m.email).join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(t => <article className="admin-tenant" key={t.id}><div className="section-heading"><div><h3>{t.name}</h3><p className="muted">{t.license ? `${t.license.kind === 'permanent' ? 'Permanente' : 'Mensual'} · ${t.license.status === 'suspended' ? 'Suspendida' : t.license.expires_at && Date.parse(t.license.expires_at) <= Date.now() ? 'Vencida' : 'Activa'}` : 'Sin licencia'} · {t.members.filter(m => m.role === 'driver' && m.active).length} / {t.license?.driver_plan==='unlimited'?'Ilimitados':t.license?.driver_limit ?? 0} choferes</p>{t.license?.expires_at && <small>Vencimiento: {new Date(t.license.expires_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</small>}</div><button disabled={busy || !t.license} onClick={() => setEditing(editing === t.id ? null : t.id)}>Editar licencia</button></div>
 <div className="table-wrap"><table><thead><tr><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{t.members.map(m => <tr key={m.user_id}><td>{m.email}</td><td>{m.role === 'owner' ? 'Titular' : 'Chofer'}</td><td>{m.active ? 'Activo' : 'Inactivo'}</td></tr>)}</tbody></table></div>
 {editing === t.id && <form className="customer-form" onSubmit={e => void saveLicense(e, t)}><LicenseFields license={t.license} disabled={busy}/><label>Estado<select name="status" defaultValue={t.license?.status ?? 'active'} disabled={busy}><option value="active">Activa</option><option value="suspended">Suspendida</option></select></label><button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar licencia'}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></form>}</article>)}
 {!tenants.length && <p className="empty">Todavía no hay soderías. Creá la primera para comenzar.</p>}{!!tenants.length && !tenants.some(t => `${t.name} ${t.members.map(m => m.email).join(' ')}`.toLowerCase().includes(search.toLowerCase())) && <p className="empty">No encontramos soderías con esa búsqueda.</p>}</section>}
 </main></div>;
}
