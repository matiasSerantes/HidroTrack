import { describe, expect, it } from 'vitest';
import { approveClose, closeTrip, decideRequest, demoOwnedStock, demoRefill, editDemoStop, loadTrip, recordVisit, scheduleStop, seedProgram, withDemoAddresses, type DemoProgramState } from './programDemo';

const input = { tripId: 't1', clientId: 'c1', actorId: 'luz', items: [{ productId: 'b20', quantity: 3, returned: 2 }], paid: '10000', method: 'Efectivo' as const };
function resolved(state: DemoProgramState) { const next = structuredClone(state); next.trips[0].stops.forEach(p => { p.status = 'tomorrow'; }); return next; }
describe('demo completa: operaciones conectadas', () => {
  it('conserva los envases propios al entregar y rellenar; solo el jefe registra recargas', () => {
    const original=seedProgram(), total=demoOwnedStock(original,'b20').total;
    const delivered=recordVisit(original,input);
    expect(demoOwnedStock(delivered,'b20').total).toBe(total);
    const filled=demoRefill(delivered,'b20',2,'owner');
    expect(demoOwnedStock(filled,'b20').total).toBe(total);
    expect(filled.products[0].depot).toBe(original.products[0].depot+2);
    expect(() => demoRefill(delivered,'b20',2,'luz')).toThrow(/Solo el jefe/);
    expect(() => demoRefill(delivered,'b20',100000,'owner')).toThrow(/vacíos/);
  });
  it('la baja no devuelve al depósito un dispenser que pertenece al cliente', () => {
    const original=seedProgram(),client=original.clients.find(c=>c.id==='c6');
    expect(client?.rentals[0].mode).toBe('customer_owned');
    original.requests.push({id:'own-leave',kind:'deactivation',clientId:'c6',authorId:'nico',status:'pending',title:'Baja',returns:[]});
    const after=decideRequest(original,'own-leave',true);
    expect(after.products.find(p=>p.id==='bomba')?.depot).toBe(original.products.find(p=>p.id==='bomba')?.depot);
    expect(after.clients.find(c=>c.id==='c6')?.rentals).toEqual(client?.rentals);
  });
  it('solo el jefe edita paradas pendientes y conserva clientes y movimientos', () => {
    const s = seedProgram();
    expect(() => editDemoStop(s, 'luz', 't1', 'c1', 'down')).toThrow(/Solo el jefe/);
    const moved = editDemoStop(s, 'owner', 't1', 'c1', 'down');
    expect(moved.trips[0].stops.map(p => p.clientId)).toEqual(['c2', 'c1', 'c3']);
    const added = editDemoStop(moved, 'owner', 't1', 'c5', 'add');
    expect(() => editDemoStop(added, 'owner', 't1', 'c5', 'add')).toThrow(/ya está/);
    const removed = editDemoStop(added, 'owner', 't1', 'c5', 'remove');
    expect(removed.clients).toEqual(s.clients); expect(removed.sales).toEqual(s.sales);
    const visited = recordVisit(s, input);
    expect(() => editDemoStop(visited, 'owner', 't1', 'c1', 'remove')).toThrow(/ya está resuelta/);
    expect(visited.sales).toHaveLength(1);
  });
  it('un bidón entregado queda pendiente y en la siguiente visita descuenta lo devuelto', () => {
    let s = seedProgram(); s.clients[0].held.b20 = 0;
    s = recordVisit(s, { ...input, items: [{ productId: 'b20', quantity: 1, returned: 0 }], paid: '0' });
    expect(s.clients[0].held.b20).toBe(1);
    s.trips[0].stage = 'approved';
    s.trips.push({ ...structuredClone(s.trips[0]), id: 'next-visit', stage: 'active', stops: [{ clientId: 'c1', status: 'pending' }], stock: { b20: 10 }, empties: {} });
    s = recordVisit(s, { ...input, tripId: 'next-visit', items: [{ productId: 'b20', quantity: 2, returned: 1 }], paid: '0' });
    expect(s.clients[0].held.b20).toBe(2);
    expect(s.trips[2].empties.b20).toBe(1);
  });
  it('reprograma con fecha sin tocar envases, stock ni ventas', () => {
    const s = seedProgram(), next = scheduleStop(s, 't1', 'c1', 'luz', 'day', '2026-10-23');
    expect(next.trips[0].stops[0]).toMatchObject({ status: 'tomorrow', rescheduleDate: '2026-10-23' });
    expect(next.clients).toEqual(s.clients); expect(next.sales).toEqual(s.sales); expect(next.trips[0].stock).toEqual(s.trips[0].stock);
    expect(scheduleStop(s, 't1', 'c1', 'luz', 'week').trips[0].stops[0].rescheduleDate).toBe('2026-10-26');
    expect(() => scheduleStop(s, 't1', 'c1', 'luz', 'day', '2026-10-18')).toThrow(/fecha posterior/);
    expect(() => scheduleStop(s, 't1', 'c1', 'nico', 'week')).toThrow(/reprogramar/);
  });
  it('actualiza tres direcciones cercanas sin borrar visitas ni clientes nuevos', () => {
    const s = recordVisit(seedProgram(), input);
    s.clients.slice(0, 3).forEach(c => { delete c.geo; c.address = 'Dirección anterior'; });
    const migrated = withDemoAddresses(s);
    expect(migrated.clients.slice(0, 3).map(c => c.address)).toEqual(['Av. de Mayo 1200', 'Av. de Mayo 1250', 'Av. de Mayo 1280']);
    expect(migrated.clients.slice(0, 3).every(c => c.geo && c.locality === 'Monserrat, CABA')).toBe(true);
    expect(migrated.sales).toEqual(s.sales);
    expect(migrated.clients[0].debt).toBe(s.clients[0].debt);
    expect(migrated.clients[3]).toEqual(s.clients[3]);
    expect(withDemoAddresses(migrated)).toEqual(migrated);
  });
  it('una visita parcial registra la entrega pero solicita aprobación antes de sumar deuda nueva', () => {
    const before = seedProgram(), after = recordVisit(before, input);
    expect(before.sales).toHaveLength(0);
    expect(after.trips[0].stock.b20).toBe(37);
    expect(after.trips[0].empties.b20).toBe(2);
    expect(after.clients[0].held.b20).toBe(3);
    expect(after.sales[0]).toMatchObject({ total: 1050000, paid: 1000000, before: 480000, after: 480000, credit: { amount: 50000, status: 'pending' } });
    expect(after.clients[0].debt).toBe(480000);
    expect(after.requests[0]).toMatchObject({ kind: 'credit', saleId: after.sales[0].id, amount: 50000, status: 'pending' });
    expect(after.trips[0].stops[0].status).toBe('visited');
    expect(after.notices[0].text).toContain('Elena');
  });
  it('solo el jefe aprueba deuda una vez, sin duplicar venta, cobro ni envases', () => {
    const pending = recordVisit(seedProgram(), input), request = pending.requests[0];
    expect(() => decideRequest(pending, request.id, true, 'luz')).toThrow(/Solo el jefe/);
    const approved = decideRequest(pending, request.id, true, 'owner');
    expect(approved.clients[0].debt).toBe(530000);
    expect(approved.sales[0].credit?.status).toBe('approved');
    expect(approved.sales[0].paid).toBe(1000000);
    expect(approved.sales).toHaveLength(1);
    expect(approved.trips).toEqual(pending.trips);
    expect(approved.clients[0].held).toEqual(pending.clients[0].held);
    expect(pending.clients[0].debt).toBe(480000);
    expect(() => decideRequest(approved, request.id, true)).toThrow(/ya fue resuelta/);
  });
  it('rechazar conserva el importe por cobrar sin convertirlo en deuda aprobada', () => {
    const pending = recordVisit(seedProgram(), input), rejected = decideRequest(pending, pending.requests[0].id, false);
    expect(rejected.clients[0].debt).toBe(480000);
    expect(rejected.sales[0].credit).toEqual({ amount: 50000, status: 'rejected' });
    expect(rejected.sales[0].total).toBe(1050000);
    expect(rejected.trips).toEqual(pending.trips);
    expect(() => decideRequest(rejected, pending.requests[0].id, true)).toThrow(/ya fue resuelta/);
  });
  it('aprobar después de otro cobro suma solo el nuevo crédito al saldo vigente', () => {
    let s = recordVisit(seedProgram(), input); const requestId = s.requests[0].id;
    s.trips[0].stops[0].status = 'pending';
    s = recordVisit(s, { ...input, items: [], paid: '4800' });
    expect(s.clients[0].debt).toBe(0);
    s = decideRequest(s, requestId, true);
    expect(s.clients[0].debt).toBe(50000);
    expect(s.sales).toHaveLength(2);
  });
  it('pago completo no pide crédito y mantener deuda anterior no la vuelve a solicitar', () => {
    const currentPaid = recordVisit(seedProgram(), { ...input, paid: '10500' });
    expect(currentPaid.clients[0].debt).toBe(480000);
    expect(currentPaid.sales[0].credit).toBeUndefined();
    expect(currentPaid.requests.filter(r => r.kind === 'credit')).toHaveLength(0);
    const fullPaid = recordVisit(seedProgram(), { ...input, paid: '15300' });
    expect(fullPaid.clients[0].debt).toBe(0);
    expect(fullPaid.requests.filter(r => r.kind === 'credit')).toHaveLength(0);
    const ownerCredit = recordVisit(seedProgram(), { ...input, actorId: 'owner' });
    expect(ownerCredit.clients[0].debt).toBe(530000);
    expect(ownerCredit.sales[0].credit?.status).toBe('approved');
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
  it('bloquea otra carga hasta cerrar el anterior y nunca modifica su carga original', () => {
    const original = seedProgram();
    original.trips.push({ ...structuredClone(original.trips[1]), id: 'next', driverId: 'luz' });
    expect(() => loadTrip(original, 'next', { b20: 5 })).toThrow(/anterior/);
    const visited = resolved(recordVisit(original, input));
    const submitted = closeTrip(visited, 't1', visited.trips[0].stock, '');
    expect(() => loadTrip(submitted, 'next', { b20: 5 })).toThrow(/anterior/);
    const approved = approveClose(submitted, 't1');
    expect(() => loadTrip(approved, 't1', { b20: 5 })).toThrow(/todavía no comenzó/);
    const next = loadTrip(approved, 'next', { b20: 5 });
    expect(next.trips[0].load).toEqual(original.trips[0].load);
    expect(next.trips.find(t => t.id === 'next')?.stock.b20).toBe(5);
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
    expect(approved.clients.find(c => c.id === 'c2')).toMatchObject({ deactivatedOn: '2026-10-19', deactivationReason: 'Mudanza', deactivatedTripIds: ['t1'] });
    expect(approved.trips[0].stops.some(p => p.clientId === 'c2')).toBe(false);
    expect(approved.products.find(p => p.id === 'frio')?.depot).toBe(9);
    expect(approved.clients.find(c => c.id === 'c2')?.note).toContain('Mudanza');
  });
});
