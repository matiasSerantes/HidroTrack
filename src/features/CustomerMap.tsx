import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Customer } from '../domain/demo';
import './CustomerMap.css';

export function hasLocation(c: Pick<Customer, 'lat' | 'lng'>): c is Customer & { lat: number; lng: number } {
 return typeof c.lat === 'number' && Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && typeof c.lng === 'number' && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180;
}
export function navigationUrl(c: Customer) {
 return hasLocation(c) ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.address, c.city, 'Argentina'].filter(Boolean).join(', '))}`;
}
export function CustomerMap({ customers, selectedId, onSelect, onPick, point, completedIds = [], road = [], origin }: { customers: Customer[]; selectedId?: string; onSelect?: (id: string) => void; onPick?: (lat: number, lng: number) => void; point?: { lat?: number; lng?: number }; completedIds?: string[]; road?: [number,number][]; origin?: {lat: number; lng: number} | null }) {
 const container = useRef<HTMLDivElement>(null);
 const map = useRef<L.Map | null>(null);
 const group = useRef<L.LayerGroup | null>(null);
 const callbacks = useRef({ onSelect, onPick }); callbacks.current = { onSelect, onPick };
 const [tileError, setTileError] = useState(false);
 const [gpsMessage, setGpsMessage] = useState('');
 const [gpsBusy, setGpsBusy] = useState(false);
 const mounted = useRef(true);
 useEffect(() => {
  mounted.current = true;
  if (!container.current) return;
  const instance = L.map(container.current, { scrollWheelZoom: false }).setView([-34.6037, -58.3816], 13);
  map.current = instance;
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(instance);
  tiles.on('tileerror', () => { if (mounted.current) setTileError(true); });
  group.current = L.layerGroup().addTo(instance);
  instance.on('click', (event: L.LeafletMouseEvent) => callbacks.current.onPick?.(event.latlng.lat, event.latlng.lng));
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.invalidateSize());
  observer?.observe(container.current);
  return () => { mounted.current = false; observer?.disconnect(); instance.remove(); map.current = null; group.current = null; };
 }, []);
 useEffect(() => {
  const instance = map.current, layers = group.current;
  if (!instance || !layers) return;
  layers.clearLayers();
  const bounds: L.LatLngTuple[] = [];
  const groups = new Map<string, { customer: Customer & {lat:number;lng:number}; index: number }[]>();
  customers.forEach((c,index) => {
   if (!hasLocation(c)) return;
   const key = `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
   groups.set(key, [...(groups.get(key) ?? []), {customer:c,index}]);
  });
  groups.forEach(items => {
   const { customer: c, index } = items[0];
   bounds.push([c.lat, c.lng]);
   const marker = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: 'customer-map-pin', html: `<span class="${items.every(item => completedIds.includes(item.customer.id)) ? 'complete' : ''}">${items.length > 1 ? `${items.length}×` : index + 1}</span>`, iconSize: [32, 38], iconAnchor: [16, 38] }), keyboard: true, title: items.length > 1 ? `${items.length} clientes en este punto` : c.name }).addTo(layers);
   const label = document.createElement('span'); label.textContent = items.length > 1 ? `${items.length} clientes: ${items.map(item => item.customer.name).join(', ')}` : `${c.name} · ${c.address}`;
   marker.bindTooltip(label);
   if (items.length === 1) marker.on('click', () => callbacks.current.onSelect?.(c.id));
   else {
    const list = document.createElement('div');
    const heading = document.createElement('strong'); heading.textContent = 'Clientes en esta ubicación'; list.append(heading);
    for (const item of items) {
     const button = document.createElement('button'); button.type = 'button'; button.textContent = `${item.index+1}. ${item.customer.name}`;
     button.style.cssText = 'display:block;margin-top:8px;width:100%;text-align:left';
     button.addEventListener('click', () => callbacks.current.onSelect?.(item.customer.id)); list.append(button);
    }
    marker.bindPopup(list);
    if (items.some(item => item.customer.id === selectedId)) marker.openPopup();
   }
  });
  if (road.length > 1) { L.polyline(road, { color: '#087bc1', weight: 6, opacity: 0.9, renderer: L.canvas() }).addTo(layers); bounds.push(...road); }
  if (origin && hasLocation(origin)) {
   const start = L.marker([origin.lat,origin.lng], { title: 'Inicio del recorrido', icon: L.divIcon({ className: 'customer-map-pin', html: '<span>▶</span>', iconSize:[32,38], iconAnchor:[16,38] }) }).addTo(layers);
   start.bindTooltip('Inicio del recorrido'); bounds.push([origin.lat,origin.lng]);
  }
  if (point && hasLocation(point)) {
   L.circleMarker([point.lat, point.lng], { radius: 10, color: '#152f42', fillColor: '#ffcc71', fillOpacity: 1, weight: 3 }).addTo(layers);
   bounds.push([point.lat, point.lng]);
  }
  const selected = customers.find(c => c.id === selectedId);
  if (selected && hasLocation(selected)) instance.setView([selected.lat, selected.lng], 16);
  else if (bounds.length) instance.fitBounds(L.latLngBounds(bounds), { padding: [35, 35], maxZoom: onPick ? 16 : 15 });
 }, [customers, selectedId, point, completedIds, onPick, road, origin]);
 function locate() {
  if (!navigator.geolocation) { setGpsMessage('Este navegador no ofrece ubicación. Marcá el punto en el mapa.'); return; }
  setGpsBusy(true); setGpsMessage('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(position => {
   if (!mounted.current) return;
   callbacks.current.onPick?.(position.coords.latitude, position.coords.longitude);
   setGpsBusy(false); setGpsMessage(`Ubicación obtenida (precisión aproximada: ${Math.round(position.coords.accuracy)} m). Confirmá que estás en el domicilio del cliente.`);
  }, () => { if (mounted.current) { setGpsBusy(false); setGpsMessage('No se pudo obtener tu ubicación. Podés marcar el punto en el mapa.'); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
 }
 return <div className="customer-map"><div className="map-canvas" ref={container} role="region" aria-label={onPick ? 'Mapa para marcar la ubicación del cliente' : 'Mapa de ubicaciones de clientes'}/>{tileError && <p role="status" className="map-message">No se pudo cargar parte del mapa. Revisá la conexión; las coordenadas y fichas siguen disponibles.</p>}{onPick && <><p className="muted">Tocá el mapa para marcar el domicilio. La dirección escrita no se convierte automáticamente en un punto.</p><button type="button" disabled={gpsBusy} onClick={locate}>{gpsBusy ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual para este cliente'}</button>{gpsMessage && <p role="status">{gpsMessage}</p>}</>}</div>;
}
