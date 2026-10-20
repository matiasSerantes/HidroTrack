import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AccountWorkspace } from './AccountWorkspace';
import { AdminWorkspace } from './AdminWorkspace';
import { DemoAccess, type DemoRole } from './DemoAccess';
import { DemoRoute } from './DemoRoute';
import { exampleAssets } from '../domain/customerAssets';
import { deliveryDate, localDate, visitsForDate } from '../domain/route';
import { DemoCustomers } from './DemoCustomers';
import { Droplets, LayoutDashboard, Users, Route, Truck, ClipboardCheck, LogOut, ArrowUp, ArrowDown, Plus, ArrowUpRight, Search, Check, X, Package, Wallet } from 'lucide-react';
import { initialState, currency, totals, parseMoney, validateDelivery, type DemoState, type Customer, type Delivery } from '../domain/demo';
import { supabase } from '../lib/supabase';

const pages = [ ['Panel principal', LayoutDashboard], ['Clientes', Users], ['Recorridos', Route], ['Entregas', Truck], ['Cierre diario', ClipboardCheck], ['Personal', Users] ] as const;
function readDemo(): DemoState {
  try { const raw = localStorage.getItem('sodacontrol.demo.v1'); if (raw) { const data = JSON.parse(raw); if (Array.isArray(data.customers) && Array.isArray(data.order) && Array.isArray(data.deliveries)) return data; } } catch { /* Una copia local dañada no impide abrir la demo. */ }
  return structuredClone(initialState);
}
function readAssignedDemo(): DemoState {
 const state = readDemo();
  if (!state.routeVersion) {
   const examples = initialState.customers.filter(c => ['lucia','kiosco'].includes(c.id) && !state.customers.some(item => item.id === c.id));
   state.customers = [...state.customers,...examples]; state.order = [...state.order,...examples.map(c=>c.id)]; state.routeVersion=1;
  }
 return { ...state, locationVersion: 1, customers: state.customers.map((c, index) => { const seed = state.locationVersion ? undefined : initialState.customers.find(item => item.id === c.id); return { ...c, assets: c.assets ?? exampleAssets(c.id), lat: c.lat ?? seed?.lat, lng: c.lng ?? seed?.lng, city: c.city ?? seed?.city, assignedTo: c.assignedTo ?? (index < 2 ? 'driver' : 'owner') }; }) };
}
export function LegacyApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase || new URLSearchParams(window.location.search).has('demo')) { setCheckingSession(false); return; }
    let active = true;
    let receivedAuthEvent = false;
    const subscription = supabase.auth.onAuthStateChange((_event, value) => {
      receivedAuthEvent = true;
      if (active) { setSession(value); setCheckingSession(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) { if (!error && !receivedAuthEvent) setSession(data.session); setCheckingSession(false); }
    }).catch(() => { if (active) setCheckingSession(false); });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, []);
  const [demo, setDemo] = useState<DemoRole | 'login' | null>(() => new URLSearchParams(window.location.search).has('demo') ? 'login' : null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setMessage('');
    try { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; setSession(data.session); }
    catch { setMessage('No pudimos iniciar sesión. Revisá tus datos y la conexión.'); } finally { setBusy(false); }
  }
  if (demo === 'login') return <DemoAccess onLogin={setDemo} onExit={() => setDemo(null)}/>;
  if (demo === 'admin') return <AdminWorkspace demo onExit={() => setDemo('login')}/>;
  if (demo === 'owner' || demo === 'driver') return <Demo role={demo} onExit={() => setDemo('login')}/>;
  if (checkingSession) return <main><p role="status">Recuperando tu sesión…</p></main>;
  if (session && supabase) return <AccountWorkspace key={session.user.id} client={supabase} userId={session.user.id}/>;
  return <div className="login"><section className="login-story"><Brand /><div><span className="eyebrow">CADA DÍA, TODO EN ORDEN</span><h1>Tu reparto.<br />Bajo control.</h1><p>Clientes, entregas y cuentas claras.<br />Más tiempo para hacer crecer tu recorrido.</p><div className="story-icons"><Truck size={38}/><span>De la primera entrega<br />al cierre del día.</span></div></div><small>Hecho para repartidores independientes.</small></section><section className="login-form"><span className="badge">PRIMERA VERSIÓN</span><h2>Bienvenido a HidroTrack</h2><p className="muted">Un lugar para organizar tu jornada.</p><form onSubmit={login}><label>Correo electrónico<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@ejemplo.com"/></label><label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label><button className="primary wide" disabled={!supabase || busy}>{busy ? 'Ingresando…' : 'Ingresar a mi cuenta'} <ArrowUpRight size={18}/></button>{!supabase && <small className="muted">El acceso con cuenta todavía no está configurado.</small>}{message && <p role="alert">{message}</p>}</form><div className="divider">CONOCÉ LA APLICACIÓN</div><button className="secondary wide" onClick={() => setDemo('login')}>Explorar demostración <ArrowUpRight size={18}/></button><small className="muted">Datos ficticios guardados en este navegador.</small></section></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon"><Droplets size={25}/></span><span>HidroTrack<small>GESTIÓN DE REPARTOS</small></span></div>; }
export function Demo({ onExit, role = 'owner' }: { onExit: () => void; role?: 'owner' | 'driver' }) {
  const [page, setPage] = useState(0);
  const [state, setState] = useState<DemoState>(readAssignedDemo);
  const [modal, setModal] = useState<'customer' | Customer | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const visibleCustomers = state.customers.filter(c => role === 'owner' || c.assignedTo === 'driver');
  const todayDeliveries = state.deliveries.filter(d => deliveryDate(d) === localDate());
  const sum = totals(todayDeliveries.filter(d => visibleCustomers.some(c => c.id === d.customerId)));
  const allRouteOrder = state.order.filter(id => state.customers.some(c => c.id === id && c.active !== false && (role === 'owner' || c.assignedTo === 'driver')));
  const todayIds = visitsForDate(visibleCustomers,localDate()).map(c=>c.id);
  const routeOrder = allRouteOrder.filter(id=>todayIds.includes(id));
  const completed = todayDeliveries.filter(d => routeOrder.includes(d.customerId)).length;
  const pending = routeOrder.filter(id => !todayDeliveries.some(d => d.customerId === id));
  function save(next: DemoState) { try { localStorage.setItem('sodacontrol.demo.v1', JSON.stringify(next)); setState(next); setNotice('Cambios guardados en este navegador.'); return true; } catch { setNotice('No se pudo guardar. Revisá el espacio disponible del navegador.'); return false; } }
  function move(index: number, direction: number) { const order = [...state.order]; const from = order.indexOf(allRouteOrder[index]), to = order.indexOf(allRouteOrder[index+direction]); if(from<0 || to<0) return; [order[from],order[to]] = [order[to],order[from]]; save({ ...state, order }); }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); const f = new FormData(e.currentTarget);
    try {
      if (modal === 'customer') {
        const name = String(f.get('name')).trim(), address = String(f.get('address')).trim();
        if (!name || !address) throw new Error('Completá nombre y dirección.');
        const quantity = Number(f.get('quantity')); if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('La cantidad debe ser un entero mayor a cero.');
        const customer: Customer = { id: crypto.randomUUID(), name, address, phone: String(f.get('phone')).trim(), days: f.getAll('days').join(' · '), quantity };
        if (!customer.days) throw new Error('Elegí al menos un día de visita.');
        save({ ...state, customers: [...state.customers, customer], order: [...state.order, customer.id] });
      } else if (modal) {
        const quantity = Number(f.get('quantity')); const d: Delivery = { createdAt: new Date().toISOString(), id: crypto.randomUUID(), customerId: modal.id, quantity, returned: Number(f.get('returned')), amountCents: quantity * 200000, paidCents: parseMoney(String(f.get('paid'))), method: f.get('method') as Delivery['method'] };
        validateDelivery(d, state.deliveries); save({ ...state, deliveries: [...state.deliveries, d] });
      }
      setModal(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Revisá los datos.'); }
  }
  const openDelivery = (c: Customer) => { setError(''); setModal(c); };
  return <div className="app"><aside><Brand/><span className="nav-label">MI REPARTO</span><nav>{pages.slice(0, 5).map(([title, Icon], i) => <button key={title} className={page === i ? 'active' : ''} onClick={() => setPage(i)}><Icon size={19}/>{title}{i === 3 && <span className="nav-count">{pending.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="avatar">SD</div><div>{role === 'driver' ? 'Chofer demo' : 'Mi reparto'}<small>{role === 'driver' ? 'Chofer' : 'Dueño y repartidor'} &middot; Demo</small></div><button title="Salir de la demo" onClick={onExit}><LogOut size={18}/></button></div></aside><main><header><div><span className="eyebrow">TU REPARTO, EN ORDEN</span><h1>{pages[page][0]}</h1><p className="muted">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })}</p></div><span className="badge"><i/> Modo demostración</span></header><div className="demo-notice"><span>Estás explorando con datos ficticios. Los cambios se guardan solo en este navegador.</span><button onClick={() => { if (confirm('¿Restablecer todos los datos de demostración?')) save({ ...structuredClone(initialState), customers: initialState.customers.map((c, index) => ({ ...c, assignedTo: index < 2 ? 'driver' : 'owner' })) }); }}>Restablecer demo</button></div>{notice && <div className="save-notice" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={14}/></button></div>}
  {page === 0 && <><div className="stats">{[[Users, 'Clientes registrados', visibleCustomers.filter(c => c.active !== false).length, 'Tu cartera de clientes'], [Truck, 'Visitas programadas', routeOrder.length, 'Recorrido de demostración'], [Check, 'Entregas completadas', completed, `${sum.units} sifones entregados`], [Wallet, 'Efectivo cobrado', currency(sum.cash), 'Cobros de esta demo']].map(([Icon, label, value, caption]) => { const I = Icon as typeof Users; return <article className="stat" key={String(label)}><div className="stat-top"><span>{String(label)}</span><I size={19}/></div><strong>{String(value)}</strong><small>{String(caption)}</small></article>; })}</div><div className="dashboard-grid"><section className="panel"><div className="section-heading"><div><h2>Tu jornada de hoy</h2><p className="muted">Cada visita cuenta.</p></div><span className="badge">{pending.length} pendientes</span></div><div className="progress"><span style={{ width: `${routeOrder.length ? completed / routeOrder.length * 100 : 0}%` }}/></div><div className="progress-label"><span>Avance del recorrido</span><strong>{completed} de {routeOrder.length} visitas</strong></div><div className="route-preview"><Route size={48}/><h3>El próximo destino te espera</h3><p>{pending.length ? state.customers.find(c => c.id === pending[0])?.name : 'Completaste todas las visitas'}</p><button className="primary" onClick={() => setPage(2)}>Ver mi recorrido <ArrowUpRight size={17}/></button></div><small className="muted">Ver ubicaciones y abrir la navegación desde Mi recorrido.</small></section><section className="panel"><div className="section-heading"><h2>Próximas visitas</h2><button className="text-button" onClick={() => setPage(3)}>Ver todas ↗</button></div>{pending.map((id, i) => { const c = state.customers.find(c => c.id === id)!; return <div className="visit" key={id}><span className="visit-number">{i + 1}</span><div><strong>{c.name}</strong><small>{c.address}</small></div><button aria-label={`Registrar visita de ${c.name}`} onClick={() => openDelivery(c)}><ArrowUpRight size={19}/></button></div>; })}{!pending.length && <p className="empty">Todo al día. ¡Buen reparto!</p>}<div className="tip"><Package size={21}/><span>Controlá los envases en cada entrega para mantener tus cuentas claras.</span></div></section></div></>}
  {page === 1 && <DemoCustomers state={state} onSave={save} role={role}/>}
  {page === 2 && <DemoRoute customers={allRouteOrder.map(id => state.customers.find(c => c.id === id)!)} deliveries={state.deliveries} onDelivery={openDelivery} onMove={role === 'owner' ? move : undefined}/>}
  {page === 3 && <section className="panel"><div className="section-heading"><div><h2>Registro de entregas</h2><p className="muted">Sifón de soda · Precio demo: {currency(200000)}</p></div><span className="badge">{pending.length} pendientes</span></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Unidades</th><th>Venta</th><th>Cobrado</th><th>Estado</th><th/></tr></thead><tbody>{routeOrder.map(id => { const c = state.customers.find(c => c.id === id)!, d = todayDeliveries.find(item => item.customerId === id); return <tr key={id}><td><strong>{c.name}</strong><small>{c.address}</small></td><td>{d?.quantity ?? c.quantity}</td><td>{currency(d?.amountCents ?? c.quantity * 200000)}</td><td>{d ? currency(d.paidCents) : '—'}</td><td><span className={`pill ${d ? 'done' : 'pending'}`}>{d ? 'Registrada' : 'Pendiente'}</span></td><td>{!d && <button className="secondary" onClick={() => openDelivery(c)}>Registrar</button>}</td></tr>; })}</tbody></table></div></section>}
  {page === 4 && <section className="panel"><h2>Resumen de jornada</h2><p className="muted">Vista previa calculada a partir de las entregas de demostración.</p><div className="summary">{[['Ventas', currency(sum.sales)], ['Efectivo cobrado', currency(sum.cash)], ['Transferencias', currency(sum.transfers)], ['A cuenta corriente', currency(sum.debt)], ['Sifones entregados', sum.units], ['Envases recuperados', sum.returned]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="notice">El envío y la aprobación del cierre estarán disponibles cuando el servidor pueda validar la carga inicial, los movimientos y la sincronización pendiente.</div></section>}
  {page === 5 && <section className="panel"><h2>Personal del reparto</h2><div className="visit"><div className="avatar">SD</div><div><strong>Titular de demostración</strong><small>Administra su propio reparto</small></div><span className="pill done">Activo</span></div><p className="muted">El alta de choferes y la asignación de permisos se habilitarán con cuentas y licencias reales.</p></section>}
  <footer><Droplets size={14}/> HidroTrack <span>Un reparto más simple, todos los días.</span></footer></main>
  {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="section-heading"><h2 id="dialog-title">{modal === 'customer' ? 'Nuevo cliente' : `Entrega · ${modal.name}`}</h2><button aria-label="Cerrar" onClick={() => setModal(null)}><X/></button></div><form onSubmit={submit}>{modal === 'customer' ? <><label>Nombre completo<input name="name" required maxLength={100} autoFocus/></label><label>Dirección<input name="address" required maxLength={200}/></label><label>Teléfono<input name="phone" type="tel" maxLength={40}/></label><label>Sifones habituales<input name="quantity" type="number" min="1" max="10000" defaultValue="2" required/></label><fieldset><legend>Días de visita</legend><div className="days">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <label key={d}><input type="checkbox" name="days" value={d}/>{d}</label>)}</div></fieldset></> : <><p className="muted">Precio unitario: {currency(200000)}. La venta se calcula automáticamente.</p><label>Sifones entregados<input name="quantity" type="number" min="1" max="10000" defaultValue={modal.quantity} required autoFocus/></label><label>Envases recuperados<input name="returned" type="number" min="0" max="10000" defaultValue={modal.quantity} required/></label><label>Medio de pago<select name="method"><option>Efectivo</option><option>Transferencia</option><option>Cuenta corriente</option></select></label><label>Importe cobrado ($)<input name="paid" inputMode="decimal" defaultValue={modal.quantity * 2000} required/></label><small className="muted">Podés registrar un pago parcial. Para cuenta corriente, ingresá 0. Las entregas confirmadas no se pueden editar en esta demo.</small></>}{error && <p className="error" role="alert">{error}</p>}<button className="primary wide">{modal === 'customer' ? 'Guardar cliente' : 'Confirmar entrega'} <Check size={17}/></button></form></section></div>}</div>;
}
