import { useState, type FormEvent } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { currency, totals, type Customer, type DemoState } from '../domain/demo';
import './DemoCustomers.css';
import { CustomerPanel } from './CustomerPanel';
import { CustomerMap, hasLocation } from './CustomerMap';

export function DemoCustomers({ state, onSave, role }: { state: DemoState; onSave: (next: DemoState) => boolean; role: 'owner' | 'driver' }) {
 const [search, setSearch] = useState('');
 const [status, setStatus] = useState('active');
 const [day, setDay] = useState('');
 const [selected, setSelected] = useState<string | null>(null);
 const [editing, setEditing] = useState<Customer | 'new' | null>(null);
 const [error, setError] = useState('');
 const [showMap, setShowMap] = useState(false);
 const [latText, setLatText] = useState('');
 const [lngText, setLngText] = useState('');
 const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
 const canManage = role === 'owner';
 const assigned = state.customers.filter(c => canManage || c.assignedTo === 'driver');
 const visible = assigned.filter(c => (status === 'all' || (status === 'archived' ? c.active === false : c.active !== false)) && (!day || c.days.split(' · ').includes(day)) && `${c.name} ${c.address} ${c.phone} ${c.city ?? ''} ${c.neighborhood ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
 const customer = assigned.find(c => c.id === selected);
 const draft = editing && editing !== 'new' ? editing : null;
 function edit(value: Customer | 'new') { setEditing(value); setError(''); setLatText(value !== 'new' && hasLocation(value) ? String(value.lat) : ''); setLngText(value !== 'new' && hasLocation(value) ? String(value.lng) : ''); }
 function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (!canManage) return;
  const f = new FormData(event.currentTarget);
  const name = String(f.get('name') ?? '').trim(), address = String(f.get('address') ?? '').trim();
  const quantity = Number(f.get('quantity')), visits = f.getAll('days').map(String);
  if (!name || !address || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !visits.length) { setError('Completá nombre, dirección, cantidad y al menos un día de visita.'); return; }
  const lat = latText.trim() ? Number(latText) : undefined, lng = lngText.trim() ? Number(lngText) : undefined;
  if ((lat !== undefined || lng !== undefined) && !hasLocation({lat,lng})) { setError('Ingresá latitud y longitud válidas, o dejá ambas vacías.'); return; }
  const next: Customer = { ...draft, id: draft?.id ?? crypto.randomUUID(), name, address, phone: String(f.get('phone') ?? '').trim(), days: visits.join(' · '), quantity, notes: String(f.get('notes') ?? '').trim(), assignedTo: draft?.assignedTo ?? 'owner', active: draft?.active ?? true, city: String(f.get('city') ?? '').trim(), neighborhood: String(f.get('neighborhood') ?? '').trim(), lat, lng };
  const updated = { ...state, customers: draft ? state.customers.map(c => c.id === next.id ? next : c) : [...state.customers, next], order: draft ? state.order : [...state.order, next.id] };
  if (onSave(updated)) { setEditing(null); setSelected(next.id); } else setError('No se pudo guardar en este navegador.');
 }
 function toggleActive(c: Customer) {
  if (!canManage || !confirm(c.active === false ? `¿Reactivar a ${c.name}? Se agregará al final del recorrido demo.` : `¿Archivar a ${c.name}? Se conservarán sus entregas, saldo e historial.`)) return;
  const active = c.active === false;
  onSave({ ...state, customers: state.customers.map(item => item.id === c.id ? { ...item, active } : item), order: active ? [...state.order.filter(id => id !== c.id), c.id] : state.order.filter(id => id !== c.id) });
 }
 return <><section className="panel"><div className="section-heading"><div><h2>{canManage ? 'Tu cartera de clientes' : 'Clientes asignados'}</h2><p className="muted">{assigned.filter(c => c.active !== false).length} activos · {assigned.filter(c => c.active === false).length} archivados</p></div>{canManage && <button className="primary" onClick={() => edit('new')}><Plus size={17}/> Nuevo cliente</button>}</div>
 <div className="customer-filters"><label>Buscar clientes<div className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, dirección o teléfono"/></div></label><label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Activos</option>{canManage && <><option value="archived">Archivados</option><option value="all">Todos</option></>}</select></label><label>Día de visita<select value={day} onChange={e => setDay(e.target.value)}><option value="">Todos los días</option>{days.map(d => <option key={d}>{d}</option>)}</select></label></div>
 <button onClick={() => setShowMap(v => !v)}>{showMap ? 'Ocultar mapa' : 'Ver clientes en mapa'}</button>{showMap && <><CustomerMap customers={visible} onSelect={setSelected}/><p className="muted">{visible.filter(c => hasLocation(c)).length} clientes ubicados. Tocá un marcador para abrir su ficha. Los puntos iniciales son ficticios.</p></>}<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Dirección</th><th>Días</th><th>Pedido habitual</th><th>Saldo demo</th><th/></tr></thead><tbody>{visible.map(c => <tr key={c.id}><td><strong>{c.name}</strong><small>{c.phone || 'Sin teléfono'}{c.active === false ? ' · Archivado' : ''}</small></td><td>{c.address}</td><td><span className="pill">{c.days}</span></td><td>{c.quantity} sifones</td><td>{currency(totals(state.deliveries.filter(d => d.customerId === c.id)).debt)}</td><td><button onClick={() => setSelected(c.id)} aria-label={`Ver ficha de ${c.name}`}>Ver ficha</button></td></tr>)}</tbody></table></div>{!visible.length && <p className="empty">No hay clientes que coincidan con estos filtros.</p>}<p className="muted">Cada cliente pertenece a una sodería. Los saldos y envases mostrados se calculan solo con las entregas de esta demo.</p></section>
 {customer && !editing && <CustomerPanel key={customer.id} customer={customer} state={state} canManage={canManage} onClose={()=>setSelected(null)} onEdit={()=>edit(customer)} onToggleActive={()=>toggleActive(customer)} onSave={assets=>onSave({...state,customers:state.customers.map(c=>c.id===customer.id?{...c,assets}:c)})}/>}
 {editing && <div className="modal-backdrop"><section className="modal customer-detail" role="dialog" aria-modal="true" aria-labelledby="edit-customer-title"><div className="section-heading"><h2 id="edit-customer-title">{draft ? 'Editar cliente' : 'Nuevo cliente'}</h2><button aria-label="Cerrar edición" onClick={() => setEditing(null)}><X/></button></div><form onSubmit={submit}><label>Nombre completo<input name="name" defaultValue={draft?.name} required maxLength={100} autoFocus/></label><label>Dirección<input name="address" defaultValue={draft?.address} required maxLength={200}/></label><label>Teléfono<input name="phone" type="tel" defaultValue={draft?.phone} maxLength={40}/></label><label>Localidad<input name="city" defaultValue={draft?.city} maxLength={100} placeholder="Ciudad o localidad"/></label><label>Barrio<input name="neighborhood" defaultValue={draft?.neighborhood} maxLength={100}/></label><label>Sifones habituales<input name="quantity" type="number" min="1" max="10000" defaultValue={draft?.quantity ?? 2} required/></label><fieldset><legend>Días de visita</legend><div className="days">{days.map(d => <label key={d}><input name="days" type="checkbox" value={d} defaultChecked={draft?.days.split(' · ').includes(d)}/>{d}</label>)}</div></fieldset><fieldset><legend>Ubicación del domicilio</legend><div className="location-fields"><label>Latitud<input type="number" step="any" min="-90" max="90" value={latText} onChange={e => setLatText(e.target.value)}/></label><label>Longitud<input type="number" step="any" min="-180" max="180" value={lngText} onChange={e => setLngText(e.target.value)}/></label></div><CustomerMap customers={[]} point={{lat: latText.trim() ? Number(latText) : undefined, lng: lngText.trim() ? Number(lngText) : undefined}} onPick={(lat,lng) => { setLatText(lat.toFixed(6)); setLngText(lng.toFixed(6)); }}/><button type="button" onClick={() => { setLatText(''); setLngText(''); }}>Quitar ubicación</button></fieldset><label>Observaciones de entrega<textarea name="notes" defaultValue={draft?.notes} maxLength={500} placeholder="Ej.: tocar timbre del local, entregar por la mañana…"/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary wide">Guardar cliente</button></form></section></div>}
 </>;
}
