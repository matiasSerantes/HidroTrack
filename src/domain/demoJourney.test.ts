// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { seedProgram } from './programDemo';
import { JOURNEY_KEY, readJourney } from './demoJourney';
afterEach(() => localStorage.clear());
describe('recuperación local de reparto demo', () => {
  it('no restaura una atención ya confirmada ni una pantalla exclusiva del jefe', () => {
    const s = seedProgram(); s.trips[0].stops[0].status = 'visited';
    localStorage.setItem(JOURNEY_KEY, JSON.stringify({ actor: 'luz', page: 'company', tripId: 't1', dialog: { type: 'visit', id: 'c1', tripId: 't1' } }));
    expect(readJourney(s)).toMatchObject({ page: 'overview', dialog: null });
  });
  it('lleva a espera al quitar el vinculo y no restaura un reparto ajeno', () => {
    const s = seedProgram();
    localStorage.setItem(JOURNEY_KEY, JSON.stringify({ actor: 'nico', page: 'delivery', tripId: 't1', dialog: null }));
    expect(readJourney(s)).toMatchObject({ page: 'overview', tripId: 't2' });
    s.members.find(m => m.id === 'nico')!.active = false;
    expect(readJourney(s)).toMatchObject({actor:'nico',page:'overview',tripId:'',dialog:null});
  });
});
