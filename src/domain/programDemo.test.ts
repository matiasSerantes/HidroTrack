import { describe, expect, it } from 'vitest';
import { approveClose, closeTrip, decideRequest, loadTrip, recordVisit, seedProgram, type DemoProgramState } from './programDemo';

const input = { tripId: 't1', clientId: 'c1', actorId: 'luz', items: [{ productId: 'b20', quantity: 3, returned: 2 }], paid: '10000', method: 'Efectivo' as const };
function resolved(state: DemoProgramState) { const next = structuredClone(state); next.trips[0].stops.forEach(p => { p.status = 'tomorrow'; }); return next; }
describe('demo completa: operaciones conectadas', () => {
  it('una visita parcial actualiza stock, envases, deuda y notificaciones sin mutar el original', () => {
    const before = seedProgram(), after = recordVisit(before, input);
    expect(before.sales).toHaveLength(0);
    expect(after.trips[0].stock.b20).toBe(37);
    expect(after.trips[0].empties.b20).toBe(2);
    expect(after.clients[0].held.b20).toBe(3);
    expect(after.sales[0]).toMatchObject({ total: 1050000, paid: 1000000, before: 480000, after: 530000 });
    expect(after.clients[0].debt).toBe(530000);
    expect(after.trips[0].stops[0].status).toBe('visited');
    expect(after.notices[0].text).toContain('Elena');
  });
  it('rechaza duplicados, exceso de stock, pagos inválidos y devoluciones imposibles', () => {
    const s = seedProgram();
    expect(() => recordVisit(recordVisit(s, input), input)).toThrow(/ya fue resuelta/);
    expect(() => recordVisit(s, { ...input, items: [{ productId: 'b20', quantity: 41, returned: 0 }] })).toThrow(/stock/);
    expect(() => recordVisit(s, { ...input, paid: '-1' })).toThrow(/importe/);
    expect(() => recordVisit(s, { ...input, paid: '999999' })).toThrow(/supera/);
    expect(() => recordVisit(s, { ...input, items: [{ productId: 'b20', quantity: 1, returned: 8 }] })).toThrow(/devolución supera/);
  });
  it('rechaza el reparto ajeno y registra cobros de deuda sin venta', () => {
    expect(() => recordVisit(seedProgram(), { ...input, actorId: 'nico' })).toThrow(/asignado/);
    const s = recordVisit(seedProgram(), { ...input, actorId: 'owner', items: [], paid: '4800' });
    expect(s.clients[0].debt).toBe(0); expect(s.sales[0].total).toBe(0);
  });
  it('alquilar un equipo crea su unidad y registra la primera cuota una sola vez', () => {
    let s = recordVisit(seedProgram(), { ...input, items: [{ productId: 'frio', quantity: 1, returned: 0 }], paid: '0' });
    const rentalId = s.clients[0].rentals[0].id;
    expect(s.sales[0].rentalIds).toContain(rentalId);
    expect(s.trips[0].stock.frio).toBe(0);
    s.trips[0].stops[0].status = 'pending';
    expect(() => recordVisit(s, { ...input, items: [], rentalIds: [rentalId], paid: '0' })).toThrow(/ya se cobró/);
  });
  it('la carga se descuenta del depósito y solo se confirma una vez', () => {
    const s = loadTrip(seedProgram(), 't2', { b20: 15 });
    expect(s.products[0].depot).toBe(225); expect(s.trips[1].stock.b20).toBe(15);
    expect(() => loadTrip(s, 't2', { b20: 15 })).toThrow(/todavía no comenzó/);
  });
  it('la rendición respeta pendientes, diferencias y aprobación única', () => {
    expect(() => closeTrip(seedProgram(), 't1', {}, '')).toThrow(/pendientes/);
    const ready = resolved(recordVisit(seedProgram(), input));
    expect(() => closeTrip(ready, 't1', {}, '')).toThrow(/diferencia/);
    const differing = closeTrip(ready, 't1', {}, 'Falta revisar el transporte');
    expect(() => approveClose(differing, 't1')).toThrow(/diferencias/);
    const submitted = closeTrip(ready, 't1', ready.trips[0].stock, 'Todo coincide');
    const approved = approveClose(submitted, 't1');
    expect(approved.products[0].depot).toBe(277);
    expect(approved.depotEmpties.b20).toBe(34);
    expect(approved.trips[0].stage).toBe('approved');
    expect(() => approveClose(approved, 't1')).toThrow(/no está pendiente/);
  });
  it('la solicitud de cliente no publica datos hasta ser aprobada', () => {
    const initial = seedProgram();
    expect(initial.clients.some(c => c.id === 'c8')).toBe(false);
    const approved = decideRequest(initial, 'req1', true);
    expect(approved.clients.some(c => c.id === 'c8')).toBe(true);
    expect(() => decideRequest(approved, 'req1', true)).toThrow(/ya fue resuelta/);
  });
  it('la baja exige devoluciones, preserva historial y excluye al cliente del recorrido', () => {
    const s = seedProgram();
    s.requests.push({ id: 'deact', kind: 'deactivation', authorId: 'luz', title: 'Baja', clientId: 'c2', reason: 'Mudanza', status: 'pending', returns: [{ rentalId: 'rent1', returned: false, good: false }] });
    expect(() => decideRequest(s, 'deact', true)).toThrow(/devolver los equipos/);
    s.requests[1].returns = [{ rentalId: 'rent1', returned: true, good: true }];
    const approved = decideRequest(s, 'deact', true);
    expect(approved.clients.find(c => c.id === 'c2')?.active).toBe(false);
    expect(approved.trips[0].stops.some(p => p.clientId === 'c2')).toBe(false);
    expect(approved.products.find(p => p.id === 'frio')?.depot).toBe(9);
    expect(approved.clients.find(c => c.id === 'c2')?.note).toContain('Mudanza');
  });
});
