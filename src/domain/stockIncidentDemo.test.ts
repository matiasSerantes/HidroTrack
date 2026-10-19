import {it,expect} from 'vitest';
import {seedProgram,demoOwnedStock} from './programDemo';
import {recordDemoStock,type StockEvent} from './stockIncidentDemo';
const input:Omit<StockEvent,'id'|'registeredAt'>={productId:'b20',quantity:1,kind:'damage',source:'customer_held',customerId:'c1',date:'2026-10-18',actorId:'owner',involvedKind:'customer',involvedId:'c1',note:'Se rompió al moverlo'};
it('la rotura disminuye el patrimonio y los envases del cliente conservando deuda y auditoría',()=>{
  const before=seedProgram(),after=recordDemoStock(before,input);
  expect(demoOwnedStock(after,'b20').total).toBe(demoOwnedStock(before,'b20').total-1);
  expect(after.clients[0].held.b20).toBe(before.clients[0].held.b20-1);
  expect(after.clients[0].debt).toBe(before.clients[0].debt);
  expect(after.stockEvents?.[0]).toMatchObject(input);expect(after.stockEvents?.[0].registeredAt).toBeTruthy();
});
it('la rotura en camión identifica al asistente sin descontar del depósito',()=>{
  const before=seedProgram(),after=recordDemoStock(before,{...input,source:'truck_ready',tripId:'t1',customerId:undefined,involvedKind:'driver',involvedId:'luz'});
  expect(after.products[0].depot).toBe(before.products[0].depot);
  expect(after.trips[0].stock.b20).toBe(before.trips[0].stock.b20-1);
});
it('rechaza cantidades imposibles, fechas futuras, personas ajenas y ajustes de asistentes',()=>{
  const s=seedProgram();
  expect(()=>recordDemoStock(s,{...input,quantity:9999})).toThrow(/insuficientes/);
  expect(()=>recordDemoStock(s,{...input,date:'2026-10-20'})).toThrow(/Fecha/);
  expect(()=>recordDemoStock(s,{...input,involvedId:'no-existe'})).toThrow(/Persona/);
  expect(()=>recordDemoStock(s,{...input,actorId:'luz'})).toThrow(/Solo el jefe/);
  expect(s.stockEvents).toBeUndefined();
});
