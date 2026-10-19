import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Droplets, LogOut, Plus, RefreshCw } from 'lucide-react';
import './OwnerWorkspace.css';
import { OwnerStock } from './OwnerStock';

type Membership = { tenant_id: string; role: string };
type Customer = { id: string; name: string; address: string; phone: string };
type License = { kind: string; status: string; expires_at: string | null };
type Workspace = { ownerName: string; tenantName: string; license: License; customers: Customer[] };

export function OwnerWorkspace({ client, userId }: { client: SupabaseClient; userId: string }) {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [stockLocked,setStockLocked]=useState(false);
  const [view,setView] = useState<'customers'|'stock'>('customers');
  useEffect(() => {
    let active = true;
    setMemberships(null); setError('');
    void (async () => {
      try {
        const result = await client.from('tenant_members').select('tenant_id, role').eq('user_id', userId).eq('active', true);
        if (result.error) throw result.error;
        if (!active) return;
        const items = (result.data ?? []) as Membership[];
        setMemberships(items);
        setTenantId(items.find(item => item.role === 'owner')?.tenant_id ?? '');
      } catch { if (active) setError('No pudimos consultar tu acceso. Revisá la conexión e intentá nuevamente.'); }
    })();
    return () => { active = false; };
  }, [client, userId, refresh]);
  useEffect(() => {
    let active = true;
    setWorkspace(null); setShowForm(false); setNotice(''); setSearch('');
    if (!tenantId) return;
    void (async () => {
      try {
        const licenseResult = await client.from('licenses').select('kind, status, expires_at').eq('tenant_id', tenantId).maybeSingle();
        if (licenseResult.error) throw licenseResult.error;
        const license = licenseResult.data as License | null;
        if (!license) throw new Error('Tu reparto todavía no tiene una licencia configurada. Contactá al administrador.');
        if (license.status !== 'active') throw new Error('La licencia de tu reparto está suspendida. Contactá al administrador.');
        if (license.kind === 'monthly' && (!license.expires_at || Date.parse(license.expires_at) <= Date.now())) throw new Error('La licencia de tu reparto venció. Contactá al administrador.');
        const [tenantResult, customersResult, profileResult] = await Promise.all([
          client.from('tenants').select('name').eq('id', tenantId).single(),
          client.from('customers').select('id, name, address, phone').eq('tenant_id', tenantId).eq('active', true).order('name'),
          client.from('user_profiles').select('full_name').eq('user_id',userId).maybeSingle(),
        ]);
        if (tenantResult.error || customersResult.error || profileResult.error) throw new Error('No pudimos consultar los datos del reparto. Revisá la conexión y tu acceso.');
        if (active) setWorkspace({ ownerName: profileResult.data?.full_name || 'Repartidor jefe', tenantName: tenantResult.data.name, license, customers: customersResult.data ?? [] });
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'No pudimos cargar tu reparto. Intentá nuevamente.'); }
    })();
    return () => { active = false; };
  }, [client, tenantId, memberships]);
  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workspace || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim(), address = String(data.get('address') ?? '').trim(), phone = String(data.get('phone') ?? '').trim();
    if (!name || !address) { setNotice('Completá nombre y dirección.'); return; }
    setBusy(true); setNotice('');
    try {
      const result = await client.from('customers').insert({ tenant_id: tenantId, name, address, phone }).select('id, name, address, phone').single();
      if (result.error) throw result.error;
      setWorkspace(current => current ? { ...current, customers: [...current.customers, result.data].sort((a, b) => a.name.localeCompare(b.name, 'es')) } : null);
      setShowForm(false); setNotice('Cliente guardado en tu reparto.');
    } catch { setNotice('No se pudo guardar el cliente. Revisá la conexión y tu licencia. Si perdiste la conexión, actualizá la lista antes de reintentar.'); }
    finally { setBusy(false); }
  }
  async function archive(customer: Customer) {
    if (busy || !confirm(`¿Archivar a ${customer.name}? Sus datos se conservarán en el historial.`)) return;
    setBusy(true); setNotice('');
    try {
      const result = await client.from('customers').update({ active: false }).eq('tenant_id', tenantId).eq('id', customer.id).select('id').single();
      if (result.error) throw result.error;
      setWorkspace(current => current ? { ...current, customers: current.customers.filter(item => item.id !== customer.id) } : null);
      setNotice('Cliente archivado.');
    } catch { setNotice('No se pudo archivar el cliente. Revisá la conexión y tus permisos.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try {
      const result = await client.auth.signOut();
      if (result.error) throw result.error;
    } catch { setNotice('No pudimos cerrar la sesión. Intentá nuevamente.'); setBusy(false); }
  }
  const owners = memberships?.filter(item => item.role === 'owner') ?? [];
  return <main className="connected-workspace"><header><div><span className="eyebrow">HIDROTRACK · MI REPARTO</span><h1><Droplets size={26}/> {workspace?.tenantName ?? 'Tu cuenta'}</h1>{workspace&&<p>{workspace.ownerName} · Jefe de reparto</p>}</div><button disabled={busy||stockLocked} onClick={signOut}><LogOut size={16}/> Cerrar sesión</button></header>
    {owners.length > 1 && <label>Reparto<select disabled={busy||stockLocked} value={tenantId} onChange={e => { setError(''); setTenantId(e.target.value); }}>{owners.map(item => <option key={item.tenant_id} value={item.tenant_id}>{item.tenant_id}</option>)}</select></label>}
    {error ? <section className="notice" role="alert"><p>{error}</p><button onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16}/> Reintentar</button></section> : memberships === null ? <p role="status">Consultando tu acceso…</p> : !owners.length ? <section className="notice">{memberships.some(item => item.role === 'driver') ? 'Tu cuenta es de chofer. El acceso a recorridos asignados se habilitará en la siguiente etapa.' : 'Tu cuenta todavía no está asignada a un reparto como titular. Contactá al administrador para completar el alta.'}</section> : !workspace ? <p role="status">Cargando tu reparto…</p> : <>
    <div className="demo-notice"><span>Cuenta de titular · {workspace.license.kind === 'permanent' ? 'Licencia permanente' : `Licencia vigente hasta ${new Date(workspace.license.expires_at!).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`}</span><button disabled={busy||stockLocked} onClick={() => setRefresh(value => value + 1)}>Actualizar datos</button></div>
    <nav className="owner-sections" aria-label="Secciones del jefe"><button disabled={stockLocked} aria-pressed={view==='customers'} onClick={()=>setView('customers')}>Clientes</button><button disabled={stockLocked} aria-pressed={view==='stock'} onClick={()=>setView('stock')}>Stock y surtidores</button></nav>
    {view==='stock' ? <OwnerStock key={tenantId} client={client} tenantId={tenantId} customers={workspace.customers} onLock={setStockLocked}/> : <section className="panel"><div className="section-heading"><div><h2>Clientes de tu reparto</h2><p className="muted">{workspace.customers.length} clientes activos</p></div><button className="primary" disabled={busy||stockLocked} onClick={() => setShowForm(value => !value)}><Plus size={16}/> Nuevo cliente</button></div>
    {showForm && <form className="customer-form" onSubmit={createCustomer}><label>Nombre completo<input name="name" required maxLength={100} autoFocus disabled={busy||stockLocked}/></label><label>Dirección<input name="address" required maxLength={200} disabled={busy||stockLocked}/></label><label>Teléfono<input name="phone" type="tel" maxLength={40} disabled={busy||stockLocked}/></label><button className="primary" disabled={busy||stockLocked}>{busy ? 'Guardando…' : 'Guardar cliente'}</button><button type="button" disabled={busy||stockLocked} onClick={() => setShowForm(false)}>Cancelar</button></form>}
    <label>Buscar clientes<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o dirección"/></label><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Dirección</th><th>Teléfono</th><th/></tr></thead><tbody>{workspace.customers.filter(c => `${c.name} ${c.address}`.toLowerCase().includes(search.toLowerCase())).map(c => <tr key={c.id}><td>{c.name}</td><td>{c.address}</td><td>{c.phone || '—'}</td><td><button disabled={busy||stockLocked} onClick={() => archive(c)}>Archivar</button></td></tr>)}</tbody></table></div>{!workspace.customers.length && <p className="empty">Tu reparto todavía no tiene clientes. Agregá el primero para comenzar.</p>}</section>}</>}
    {notice && <p className="notice" role="status">{notice}</p>}
  </main>;
}
