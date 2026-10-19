// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { positionStatus, readDemoPosition, writeDemoPosition } from './demoTracking';
afterEach(() => localStorage.clear());
describe('ubicación compartida de la demo', () => {
  it('distingue posición reciente, antigua, pausada y desconocida', () => {
    const now = Date.now(), point = { lat: -34.609, lng: -58.384, updatedAt: now, sharing: true };
    writeDemoPosition('test-point', point);
    expect(readDemoPosition('test-point')).toEqual(point);
    expect(positionStatus(point, now)).toBe('En mapa · demo');
    expect(positionStatus(point, now + 46000)).toBe('Sin actualización reciente');
    expect(positionStatus({ ...point, sharing: false }, now)).toBe('Ubicación pausada');
    expect(positionStatus(null)).toBe('Sin ubicación');
  });
  it('rechaza coordenadas imposibles y no interpreta la selección antigua como señal GPS', () => {
    localStorage.setItem('test-point', JSON.stringify({ selected: 'c1', step: 1 }));
    expect(readDemoPosition('test-point')).toBeNull();
    localStorage.setItem('test-point', JSON.stringify({ lat: 100, lng: 0, updatedAt: Date.now(), sharing: true }));
    expect(readDemoPosition('test-point')).toBeNull();
  });
});
