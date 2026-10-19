export const POSITION_EVENT = 'hidrotrack:demo-position';
export type DemoPosition = { lat: number; lng: number; updatedAt: number; sharing: boolean; currentClientId?: string | null };
export function readDemoPosition(key: string): DemoPosition | null {
  try {
    const p = JSON.parse(localStorage.getItem(key) || 'null');
    if (!p || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180 || !Number.isFinite(p.updatedAt) || p.updatedAt > Date.now() + 60000 || typeof p.sharing !== 'boolean') return null;
    return p;
  } catch { return null; }
}
export function writeDemoPosition(key: string, value: DemoPosition & Record<string, unknown>) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(POSITION_EVENT));
}
export function positionStatus(position: DemoPosition | null, now = Date.now()) {
  if (!position) return 'Sin ubicación';
  if (!position.sharing) return 'Ubicación pausada';
  if (now - position.updatedAt > 45000) return 'Sin actualización reciente';
  return 'En mapa · demo';
}
