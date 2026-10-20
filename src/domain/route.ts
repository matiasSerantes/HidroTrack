import type { Customer, Delivery } from './demo';
export function localDate(date = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
 return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function visitDay(date: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
 const value = new Date(`${date}T12:00:00Z`);
 if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0,10) !== date) return '';
 return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][value.getUTCDay()];
}
export function visitsForDate(customers: Customer[], date: string) {
 const day = visitDay(date);
 return day ? customers.filter(c => c.active !== false && c.days.split(' · ').includes(day)) : [];
}
export function deliveryDate(delivery: Pick<Delivery,'createdAt'>) {
 return delivery.createdAt && Number.isFinite(Date.parse(delivery.createdAt)) ? localDate(new Date(delivery.createdAt)) : localDate();
}
export type RoadRoute = { points: [number,number][]; distance: number; duration: number };
export async function fetchRoadRoute(points: {lat: number; lng: number}[], signal: AbortSignal): Promise<RoadRoute> {
 const unique = points.filter((p,i) => !i || p.lat !== points[i-1].lat || p.lng !== points[i-1].lng);
 if (unique.length < 2) return { points: unique.map(p => [p.lat,p.lng]), distance: 0, duration: 0 };
 if (unique.length > 80) throw new Error('Para esta demo se pueden trazar hasta 80 puntos por vez.');
 const coordinates = unique.map(p => `${p.lng},${p.lat}`).join(';');
 const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&alternatives=false`, { signal });
 if (!response.ok) throw new Error('No se pudo consultar el camino por calles.');
 const data = await response.json();
 const route = data.routes?.[0];
 if (data.code !== 'Ok' || !route || !Array.isArray(route.geometry?.coordinates) || route.geometry.coordinates.length < 2 || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || route.distance < 0 || route.duration < 0) throw new Error('No se encontró un camino entre las ubicaciones.');
 if (!route.geometry.coordinates.every((p: unknown) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) throw new Error('El servicio devolvió un camino inválido.');
 return { points: route.geometry.coordinates.map((p: number[]) => [p[1],p[0]]), distance: route.distance, duration: route.duration };
}
