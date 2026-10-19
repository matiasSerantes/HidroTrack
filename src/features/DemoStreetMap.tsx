import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowRight, LocateFixed, MapPin, Navigation, RotateCcw } from 'lucide-react';
import { DEMO_ORIGIN, type Client, type Stop } from '../domain/programDemo';
import 'leaflet/dist/leaflet.css';
import './DemoStreetMap.css';

type Props = { clients: Client[]; stops: Stop[]; initialClientId?: string; onClient: (id: string) => void };
export default function DemoStreetMap({ clients, stops, initialClientId, onClient }: Props) {
  const container = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layers = useRef<L.LayerGroup | null>(null), fitted = useRef(false);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [step, setStep] = useState(0), [selected, setSelected] = useState(initialClientId || clients[0]?.id || '');
  const points = useMemo(() => clients.filter((c): c is Client & { geo: { lat: number; lng: number } } => Boolean(c.geo && Number.isFinite(c.geo.lat) && Number.isFinite(c.geo.lng))), [clients]);
  const current = step > 0 && points.length ? points[(step - 1) % points.length] : undefined;
  const position = current?.geo || DEMO_ORIGIN;
  const selectedClient = clients.find(c => c.id === selected) || points[0];

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView([DEMO_ORIGIN.lat, DEMO_ORIGIN.lng], 17);
    map.current = instance;
    L.control.zoom({ position: 'bottomleft' }).addTo(instance);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
    tiles.on('tileerror', () => setFailed(true));
    tiles.addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    setReady(true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.invalidateSize({ animate: false }));
    observer?.observe(container.current);
    const timer = setTimeout(() => instance.invalidateSize({ animate: false }), 0);
    return () => { clearTimeout(timer); observer?.disconnect(); instance.remove(); map.current = null; layers.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    if (!ready || !map.current || !layers.current) return;
    const group = layers.current; group.clearLayers();
    const coords: L.LatLngTuple[] = points.map(c => [c.geo.lat, c.geo.lng]);
    // La unión indica el orden de visita: no es una ruta vial calculada.
    if (coords.length > 1 && L.Browser.svg) L.polyline(coords, { color: '#078793', weight: 4, opacity: .8, dashArray: '7 8' }).addTo(group);
    points.forEach((c, index) => {
      const visited = stops.find(s => s.clientId === c.id)?.status === 'visited';
      const marker = L.marker([c.geo.lat, c.geo.lng], {
        icon: L.divIcon({ className: 'hd-street-pin-host', html: `<span class="hd-street-pin ${visited ? 'visited' : ''}">${index + 1}</span>`, iconSize: [42, 46], iconAnchor: [21, 46] }),
        title: `${index + 1}. ${c.name} · ${c.address}`, keyboard: true,
      });
      const label = document.createElement('span'); label.textContent = `${c.name} · ${c.address}`;
      marker.bindTooltip(label, { direction: 'top', offset: [0, -42] });
      marker.on('click', () => setSelected(c.id)).addTo(group);
    });
    const locationLabel = document.createElement('span'); locationLabel.textContent = 'Tu ubicación actual (demo). No usa GPS.';
    L.marker([position.lat, position.lng], {
      icon: L.divIcon({ className: 'hd-location-host', html: '<span class="hd-location-halo"><span></span></span>', iconSize: [52, 52], iconAnchor: [26, 26] }),
      title: 'Ubicación actual simulada', zIndexOffset: 1000,
    }).bindTooltip(locationLabel, { direction: 'top', offset: [0, -20] }).addTo(group);
    if (!fitted.current) { map.current.fitBounds(L.latLngBounds([[DEMO_ORIGIN.lat, DEMO_ORIGIN.lng], ...coords]), { padding: [48, 48], maxZoom: 17 }); fitted.current = true; }
  }, [ready, points, position.lat, position.lng, stops]);

  function centerLocation() { map.current?.setView([position.lat, position.lng], 18, { animate: false }); }
  function seeAll() { map.current?.fitBounds(L.latLngBounds([[position.lat, position.lng], ...points.map(c => [c.geo.lat, c.geo.lng] as L.LatLngTuple)]), { padding: [48, 48], maxZoom: 17, animate: false }); }
  function advance() { const next = step >= points.length ? 0 : step + 1; setStep(next); const p = next ? points[next - 1] : undefined; if (p) setSelected(p.id); map.current?.setView([p?.geo.lat || DEMO_ORIGIN.lat, p?.geo.lng || DEMO_ORIGIN.lng], 18, { animate: false }); }
  function selectClient(c: Client) { setSelected(c.id); if (c.geo) map.current?.setView([c.geo.lat, c.geo.lng], 18, { animate: false }); }

  return <div className="hd-street-map-view"><div className="hd-map-live-header"><span className="hd-current-location-dot"/><div><strong>Tu ubicación actual · DEMO</strong><small>{current ? `Llegaste a ${current.address}` : 'Punto de partida · Monserrat, CABA'} · simulación manual</small></div><span className="hd-tag mint">Sin GPS real</span></div><div className="hd-real-map-wrap"><div ref={container} className="hd-real-map" role="region" aria-label="Mapa de calles con clientes y ubicación simulada"/><button className="hd-map-center" onClick={centerLocation} aria-label="Centrar ubicación actual demo"><LocateFixed size={21}/></button></div>{failed && <div className="hd-callout" role="status">No se pudo cargar parte del mapa de calles. Necesita conexión a internet; podés seguir probando las paradas y la posición simulada.</div>}<div className="hd-map-main-actions"><button className="hd-btn primary" onClick={centerLocation}><LocateFixed size={17}/> Mi ubicación (demo)</button><button className="hd-btn" onClick={seeAll}><MapPin size={17}/> Ver recorrido</button><button className="hd-btn" disabled={!points.length} onClick={advance}><Navigation size={17}/>{step >= points.length ? 'Volver al inicio' : 'Simular avance'}</button></div><div className="hd-street-stops" aria-label="Paradas del mapa">{points.map((c, index) => <button key={c.id} onClick={() => selectClient(c)} className={selectedClient?.id === c.id ? 'selected' : ''}><span>{index + 1}</span><div><strong>{c.name}</strong><small>{c.address}</small></div></button>)}</div>{selectedClient && <div className="hd-map-selected-client"><div><span className="hd-kicker">CLIENTE SELECCIONADO</span><h3>{selectedClient.name}</h3><p>{selectedClient.address} · {selectedClient.locality}</p><small>{selectedClient.usual}</small></div><button className="hd-btn primary" onClick={() => onClient(selectedClient.id)}>Abrir ficha <ArrowRight size={16}/></button></div>}{!points.length && <div className="hd-callout">Este reparto todavía no tiene clientes con coordenadas demo. El recorrido de Lucía incluye tres direcciones cercanas para probar el mapa.</div>}{clients.length > points.length && <p className="hd-help">{clients.length - points.length} cliente(s) de este reparto todavía sin coordenadas: no se inventó su ubicación.</p>}<p className="hd-street-map-note"><RotateCcw size={14}/> Calles reales; clientes y ubicación ficticios. Puntos aproximados de ejemplo, no entradas geocodificadas. La línea une las paradas; no calcula navegación vial. Simular avance no registra ventas ni visitas.</p></div>;
}
