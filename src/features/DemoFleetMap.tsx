import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowUpRight, MapPin, Radio, Route } from 'lucide-react';
import { DEMO_ORIGIN, isDone, type DemoProgramState } from '../domain/programDemo';
import { mapPositionKey } from '../domain/demoJourney';
import { POSITION_EVENT, positionStatus, readDemoPosition } from '../domain/demoTracking';
import 'leaflet/dist/leaflet.css';
import './DemoStreetMap.css';
import './DemoFleetMap.css';

const colors = ['#078e97', '#9260ca', '#d58c20', '#467ccd'];
export default function DemoFleetMap({ state: s, onOpenTrip }: { state: DemoProgramState; onOpenTrip: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), group = useRef<L.LayerGroup | null>(null), fitted = useRef(false);
  const [revision, setRevision] = useState(0), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [filter, setFilter] = useState('all');
  useEffect(() => {
    const update = () => setRevision(v => v + 1);
    const stored = (e: StorageEvent) => { if (!e.key || e.key.startsWith('hidrotrack.demo-map.')) update(); };
    window.addEventListener(POSITION_EVENT, update); window.addEventListener('storage', stored);
    const timer = setInterval(update, 10000);
    return () => { window.removeEventListener(POSITION_EVENT, update); window.removeEventListener('storage', stored); clearInterval(timer); };
  }, []);
  const tracks = useMemo(() => s.members.filter(m => m.role === 'driver' && m.active).map((member, index) => {
    const trips = s.trips.filter(t => t.driverId === member.id && t.stage !== 'approved');
    return { member, color: colors[index % colors.length], trips, positions: trips.map(t => ({ trip: t, position: readDemoPosition(mapPositionKey(member.id, t.id)) })) };
  }), [s, revision]);
  const shown = tracks.filter(t => filter === 'all' || filter === t.member.id);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView([DEMO_ORIGIN.lat, DEMO_ORIGIN.lng], 16); map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).on('tileerror', () => setFailed(true)).addTo(instance);
    group.current = L.layerGroup().addTo(instance); setReady(true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.invalidateSize({ animate: false })); observer?.observe(container.current);
    return () => { observer?.disconnect(); instance.remove(); map.current = null; group.current = null; fitted.current = false; };
  }, []);

  function fitAll() {
    const coords: L.LatLngTuple[] = [];
    shown.forEach(t => t.positions.forEach(({ trip, position }) => { if (position) coords.push([position.lat, position.lng]); trip.stops.forEach(p => { const c = s.clients.find(c => c.id === p.clientId); if (c?.geo) coords.push([c.geo.lat, c.geo.lng]); }); }));
    if (coords.length) map.current?.fitBounds(L.latLngBounds(coords), { padding: [45, 45], maxZoom: 17, animate: false });
  }
  useEffect(() => {
    if (!ready || !group.current) return;
    const layer = group.current; layer.clearLayers();
    shown.forEach(({ member, positions, color }) => positions.forEach(({ trip, position }) => {
      const points = trip.stops.flatMap(p => { const c = s.clients.find(c => c.id === p.clientId); return c?.geo ? [{ c, p }] : []; });
      if (points.length > 1 && L.Browser.svg) L.polyline(points.map(({ c }) => [c.geo!.lat, c.geo!.lng] as L.LatLngTuple), { color, weight: 4, dashArray: '6 9', opacity: .6 }).addTo(layer);
      points.forEach(({ c, p }, i) => {
        const label = document.createElement('span'); label.textContent = `${trip.name}: ${c.name} · ${isDone(p) ? 'resuelta' : 'pendiente'}`;
        L.marker([c.geo!.lat, c.geo!.lng], { icon: L.divIcon({ className: 'hd-fleet-stop', html: `<span style="border-color:${color}">${i + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }), title: `${member.name} · parada ${i + 1}` }).bindTooltip(label).addTo(layer);
      });
      if (position) {
        const tag = document.createElement('div'); tag.className = 'hd-fleet-person'; tag.style.backgroundColor = color;
        tag.textContent = member.name.split(' ').map(n => n[0]).slice(0, 2).join('');
        const label = document.createElement('div'); label.textContent = `${member.name} · ${positionStatus(position)} · ${new Date(position.updatedAt).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;
        const marker = L.marker([position.lat, position.lng], { zIndexOffset: 1000, icon: L.divIcon({ className: 'hd-fleet-person-host', html: tag, iconSize: [44, 44], iconAnchor: [22, 22] }), title: `Ubicación demo de ${member.name}` });
        marker.bindTooltip(label, { direction: 'top', offset: [0, -23] }).on('click', () => setFilter(member.id)).addTo(layer);
      }
    }));
    if (!fitted.current) { fitAll(); fitted.current = true; }
  }, [ready, tracks, filter]);
  useEffect(() => { if (ready) fitAll(); }, [filter, ready]);
  return <div className="hd-fleet"><div className="hd-callout"><Radio size={21}/><div><strong>Mapa del equipo · demostración</strong><p>La posición simulada del asistente se comparte mientras tenga abierto el mapa. Podés probarlo cambiando de rol o con dos pestañas de esta misma web en el mismo navegador. No es GPS ni transmisión entre teléfonos reales.</p></div></div><div className="hd-toolbar"><select aria-label="Asistentes visibles en el mapa" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos mis asistentes</option>{tracks.map(t => <option key={t.member.id} value={t.member.id}>{t.member.name}</option>)}</select><button className="hd-btn" onClick={fitAll}><MapPin size={17}/> Ver todo el equipo</button></div><div className="hd-real-map hd-fleet-map" ref={container} role="region" aria-label="Mapa del jefe con repartos y ubicación de asistentes"/>{failed && <p className="hd-help" role="status">No se pudo cargar parte del mapa de calles. Requiere internet; las tarjetas conservan los últimos datos de ejemplo recibidos.</p>}<div className="hd-fleet-cards">{shown.map(({ member, color, positions }) => <article className="hd-card" key={member.id} style={{ borderTop: `4px solid ${color}` }}><div className="hd-section"><div><h2>{member.name}</h2><p>Asistente de {s.company.name}</p></div><span className="hd-avatar" style={{ color }}> <Radio size={20}/></span></div>{positions.length ? positions.map(({ trip, position }) => <div key={trip.id} className="hd-fleet-trip"><strong>{trip.name}</strong><span className="hd-tag" role="status">{positionStatus(position)}</span><p>{trip.stops.filter(isDone).length} / {trip.stops.length} paradas resueltas</p><p>{position ? `${position.currentClientId ? s.clients.find(c => c.id === position.currentClientId)?.name || 'Punto demo' : 'Punto de partida demo'} · actualizado ${new Date(position.updatedAt).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}` : 'Todavía no abrió su mapa o no hay una posición demo recibida.'}</p>{position && <button className="hd-btn small" onClick={() => map.current?.setView([position.lat, position.lng], 18, { animate: false })}>Centrar a {member.name.split(' ')[0]}</button>}<button className="hd-btn small" onClick={() => onOpenTrip(trip.id)}><Route size={15}/> Ver reparto <ArrowUpRight size={14}/></button></div>) : <p>Sin repartos abiertos asignados.</p>}</article>)}</div><p className="hd-help">Los marcadores con iniciales son asistentes; los números son clientes. Las líneas muestran el orden de sus repartos, sin calcular navegación vial. Si la página del asistente se oculta o cierra, queda la última posición como pausada; si deja de actualizar, se indica expresamente.</p></div>;
}
