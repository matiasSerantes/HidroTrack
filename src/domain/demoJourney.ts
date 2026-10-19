import type { DemoProgramState, Page } from './programDemo';

export const JOURNEY_KEY = 'hidrotrack.demo-journey.v1';
export type Journey = { actor: string; page: Page; tripId: string; dialog: { type: 'visit' | 'detail' | 'map'; id?: string; tripId?: string } | null };
const pages: Page[] = ['overview', 'routes', 'delivery', 'customers', 'catalog', 'inventory', 'team', 'approvals', 'reports', 'company'];
export function readJourney(state: DemoProgramState): Journey | null {
  try {
    const saved = JSON.parse(localStorage.getItem(JOURNEY_KEY) || 'null');
    if (!saved || !state.members.some(m => m.id === saved.actor && m.active)) return null;
    const owner = saved.actor === 'owner';
    const trip = state.trips.find(t => t.id === saved.tripId && (owner || t.driverId === saved.actor));
    let page: Page = pages.includes(saved.page) ? saved.page : 'overview';
    if ((!owner && ['team', 'company'].includes(page)) || (page === 'delivery' && !trip)) page = 'overview';
    let dialog: Journey['dialog'] = null;
    const d = saved.dialog;
    if (d && ['visit', 'detail', 'map'].includes(d.type)) {
      const target = state.trips.find(t => t.id === d.tripId && (owner || t.driverId === saved.actor));
      const client = state.clients.find(c => c.id === d.id && (owner || c.active && state.trips.some(t => t.driverId === saved.actor && t.stops.some(p => p.clientId === c.id))));
      if (d.type === 'map' && target || d.type === 'detail' && client || d.type === 'visit' && client && target?.stage === 'active' && target.stops.some(p => p.clientId === client.id && ['pending', 'later'].includes(p.status))) dialog = { type: d.type, id: client?.id, tripId: target?.id };
    }
    return { actor: saved.actor, page, tripId: trip?.id || state.trips.find(t => owner || t.driverId === saved.actor)?.id || '', dialog };
  } catch { return null; }
}
export const draftKey = (actor: string, tripId: string, clientId: string) => `hidrotrack.demo-draft.${actor}.${tripId}.${clientId}`;
export const mapPositionKey = (actor: string, tripId: string) => `hidrotrack.demo-map.${actor}.${tripId}`;
export type VisitDraft = { quantities: Record<string, number>; returns: Record<string, number>; rentals: string[]; paid: string; method: 'Efectivo' | 'Transferencia' };
export function readVisitDraft(key: string): VisitDraft {
  const empty: VisitDraft = { quantities: {}, returns: {}, rentals: [], paid: '0', method: 'Efectivo' };
  try {
    const d = JSON.parse(localStorage.getItem(key) || 'null');
    if (!d || typeof d.quantities !== 'object' || !d.quantities || typeof d.returns !== 'object' || !d.returns || !Array.isArray(d.rentals) || typeof d.paid !== 'string' || !['Efectivo', 'Transferencia'].includes(d.method)) return empty;
    if (![...Object.values(d.quantities), ...Object.values(d.returns)].every(n => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 100000) || !d.rentals.every((id: unknown) => typeof id === 'string')) return empty;
    return d;
  } catch { return empty; }
}
export function clearJourney() { try { localStorage.removeItem(JOURNEY_KEY); } catch { /* El botón de salir sigue disponible. */ } }
export function clearJourneyDrafts() {
  try { Object.keys(localStorage).filter(k => k.startsWith('hidrotrack.demo-draft.') || k.startsWith('hidrotrack.demo-map.') || k.startsWith('hidrotrack.demo-arrival.')).forEach(k => localStorage.removeItem(k)); } catch { /* Sin persistencia, la demo trabaja en memoria. */ }
}
