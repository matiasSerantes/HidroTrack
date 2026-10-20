import { useEffect, useMemo, useRef, useState } from 'react';
import { CustomerMap, hasLocation, navigationUrl } from './CustomerMap';
import { deliveryDate, fetchRoadRoute, localDate, visitsForDate, visitDay, type RoadRoute } from '../domain/route';
import type { Customer, Delivery } from '../domain/demo';

export function DemoRoute({ customers, deliveries, onDelivery, onMove }: { customers: Customer[]; deliveries: Delivery[]; onDelivery: (customer: Customer) => void; onMove?: (index: number, direction: number) => void }) {
 const [selected, setSelected] = useState('');
 const [date, setDate] = useState(localDate);
 const [pendingOnly, setPendingOnly] = useState(false);
 const [origin, setOrigin] = useState<{lat:number;lng:number} | null>(null);
 const [route, setRoute] = useState<RoadRoute | null>(null);
 const [message, setMessage] = useState('');
 const [busy, setBusy] = useState(false);
 const [gpsBusy, setGpsBusy] = useState(false);
 const request = useRef<AbortController | null>(null);
 const generation = useRef(0);
 const mounted = useRef(true);
 const completed = useMemo(() => deliveries.filter(d => deliveryDate(d) === date).map(d => d.customerId), [deliveries,date]);
 const visits = useMemo(() => visitsForDate(customers,date), [customers,date]);
 const filtered = useMemo(() => visits.filter(c => !pendingOnly || !completed.includes(c.id)), [visits,pendingOnly,completed]);
 const located = filtered.filter(c => hasLocation(c));
 const key = JSON.stringify([date,pendingOnly,origin,filtered.map(c => [c.id,c.lat,c.lng])]);
 useEffect(() => { generation.current++; request.current?.abort(); setRoute(null); setBusy(false); setMessage(''); }, [key]);
 useEffect(() => { mounted.current = true; return () => { mounted.current=false; generation.current++; request.current?.abort(); }; }, []);
 async function drawRoute() {
  request.current?.abort();
  const controller = new AbortController(); request.current=controller;
  const version=++generation.current;
  const timer=setTimeout(() => controller.abort(),20000);
  setBusy(true); setMessage(''); setRoute(null);
  try {
   const points = [...(origin ? [origin] : []), ...located.filter(hasLocation).map(c => ({lat:c.lat,lng:c.lng}))];
   const result = await fetchRoadRoute(points,controller.signal);
   if (mounted.current && generation.current === version) {
    setRoute(result);
    setMessage(result.distance === 0 ? 'Todos los clientes están en el mismo punto: se conserva una visita por cliente.' : 'Camino trazado en el orden de la lista. El tiempo estimado no incluye entregas ni tráfico en vivo.');
   }
  } catch { if (mounted.current && generation.current === version) setMessage('No pudimos trazar el camino por calles. Revisá la conexión y reintentá; tus clientes siguen en la lista.'); }
  finally { clearTimeout(timer); if (mounted.current && generation.current === version) setBusy(false); }
 }
 function locateStart() {
  if (!navigator.geolocation) { setMessage('Tu navegador no ofrece ubicación. Podés comenzar desde el primer cliente.'); return; }
  setGpsBusy(true);
  navigator.geolocation.getCurrentPosition(position => {
   if (!mounted.current) return;
   setOrigin({lat:position.coords.latitude,lng:position.coords.longitude}); setGpsBusy(false);
  }, () => { if (mounted.current) { setGpsBusy(false); setMessage('No pudimos obtener tu ubicación. Revisá el permiso o comenzá desde el primer cliente.'); } }, {enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 function moveVisit(c: Customer, direction: number) {
  const index=customers.findIndex(item => item.id===c.id);
  const neighbor=visits[visits.findIndex(item=>item.id===c.id)+direction];
  if (!neighbor || !onMove) return;
  const target=customers.findIndex(item=>item.id===neighbor.id);
  onMove(index,target-index);
 }
 return <section className="panel"><div className="section-heading"><div><h2>Recorrido del día</h2><p className="muted">Visitá a cada cliente de la jornada, incluso cuando compartan cuadra o domicilio.</p></div><span className="badge">{visits.length} clientes · {visits.filter(c=>completed.includes(c.id)).length} visitados</span></div>
 <div className="customer-filters"><label>Fecha del recorrido<input type="date" value={date} onChange={e => {setDate(e.target.value);setSelected('');}}/></label><label>Visitas<select value={pendingOnly ? 'pending' : 'all'} onChange={e => setPendingOnly(e.target.value === 'pending')}><option value="all">Todas las del día</option><option value="pending">Solo pendientes</option></select></label><button onClick={()=>setDate(localDate())}>Ver hoy</button></div>
 <p className="muted">{visitDay(date) ? `Visitas habituales del ${visitDay(date)}.` : 'Elegí una fecha válida.'} Las ubicaciones iniciales son ficticias de Buenos Aires.</p>
 <div className="admin-actions"><button disabled={gpsBusy||busy} onClick={locateStart}>{gpsBusy?'Obteniendo ubicación…':'Empezar desde mi ubicación'}</button>{origin && <button disabled={busy} onClick={()=>setOrigin(null)}>Empezar en el primer cliente</button>}<button className="primary" disabled={busy || !located.length || (located.length < 2 && !origin)} onClick={()=>void drawRoute()}>{busy?'Trazando camino…':'Marcar camino por calles'}</button></div>
 <p className="muted">{origin?'Se incluyó tu ubicación como inicio.':'El camino empieza en el primer cliente ubicado.'} Al trazar se consultan las coordenadas en el servicio de rutas OSRM; no se envían nombres ni teléfonos. El orden lo decidís vos.</p>
 {message && <p className="notice" role="status">{message}</p>}{route && <div className="demo-notice"><span>{(route.distance/1000).toLocaleString('es-AR',{maximumFractionDigits:1})} km · {Math.ceil(route.duration/60)} min de manejo aproximados · {filtered.length} clientes</span></div>}
 <div className="map-layout"><div><CustomerMap customers={filtered} selectedId={selected} onSelect={setSelected} completedIds={completed} road={route?.points} origin={origin}/><p className="muted">{located.length} clientes ubicados · {filtered.length-located.length} sin ubicación (no se incluyen en el camino). Cada número es un cliente. Un marcador “2×” indica dos clientes en el mismo punto: tocá para elegirlos.</p></div><div>{filtered.map((c,index)=><article className="map-stop" key={c.id}><h3>{index+1}. {c.name}</h3><p>{c.address}{c.city?`, ${c.city}`:''}</p><p className="muted">{c.quantity} sifones · {completed.includes(c.id)?'Entrega registrada':'Pendiente'}</p><div className="admin-actions"><button disabled={!hasLocation(c)} onClick={()=>setSelected(c.id)}>Ubicar</button><a className="secondary" href={navigationUrl(c)} target="_blank" rel="noopener noreferrer">{hasLocation(c)?'Cómo llegar ↗':'Buscar dirección ↗'}</a>{!completed.includes(c.id) && date===localDate() && <button className="primary" onClick={()=>onDelivery(c)}>Entregar</button>}{onMove && !pendingOnly && <><button aria-label={`Subir a ${c.name}`} disabled={index===0} onClick={()=>moveVisit(c,-1)}>↑</button><button aria-label={`Bajar a ${c.name}`} disabled={index===filtered.length-1} onClick={()=>moveVisit(c,1)}>↓</button></>}</div></article>)}{!filtered.length && <p className="empty">No hay visitas para esta fecha y estos filtros.</p>}</div></div>
 </section>;
}
