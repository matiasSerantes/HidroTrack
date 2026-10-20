import {describe,it,expect} from 'vitest';
import {approveClose,closeTrip,demoOwnedStock,recordVisit,seedProgram} from './programDemo';
import {assignExtraVisit,createExtraVisit} from './customerVisitsDemo';

describe('planilla, visita extra y cambio de dispenser · demo',()=>{
 it('conserva el bidón que no devuelve y solo suma uno vacío al camión',()=>{
  const s=seedProgram(),next=recordVisit(s,{tripId:'t1',clientId:'c1',actorId:'luz',items:[{productId:'b20',quantity:0,returned:1}],paid:'0',method:'Efectivo'});
  expect(next.clients.find(c=>c.id==='c1')!.held.b20).toBe(1);expect(next.trips[0].empties.b20).toBe(1);
  expect(next.sales[0].total).toBe(0);expect(s.clients[0].held.b20).toBe(2);
 });
 it('genera y asigna visita adicional sin cambiar hábito, día semanal ni carga',()=>{
  const s=seedProgram();s.trips[1].date='2026-10-20';const next=createExtraVisit(s,{clientId:'c1',date:'2026-10-20',productId:'b20',quantity:2,note:'Llamó antes del lunes'},'owner');
  expect(next.clients[0]).toEqual(s.clients[0]);expect(next.trips).toEqual(s.trips);
  const assigned=assignExtraVisit(next,next.extraVisits![0].id,'t2','owner');
  expect(assigned.trips[1].stops.at(-1)).toMatchObject({clientId:'c1',extraVisitId:next.extraVisits![0].id});expect(assigned.trips[1].load).toEqual({});
  expect(assigned.clients[0].visitDays).toEqual([1]);
  expect(()=>assignExtraVisit(next,next.extraVisits![0].id,'t1','owner')).toThrow('fecha');
  expect(()=>assignExtraVisit(assigned,next.extraVisits![0].id,'t2','owner')).toThrow('pendiente');
  expect(()=>createExtraVisit(s,{clientId:'c1',date:'2026-10-20',productId:'b20',quantity:2,note:''},'luz')).toThrow('Solo el jefe');
 });
 it('cambia equipo sin nueva cuota y conserva contrato, stock e historial de retirado',()=>{
  const s=seedProgram(),previous=s.clients.find(c=>c.id==='c2')!.rentals[0];
  const next=recordVisit(s,{tripId:'t1',clientId:'c2',actorId:'luz',items:[],paid:'0',method:'Efectivo',dispenserChange:{rentalId:previous.id,productId:'frio',condition:'damaged'}});
  const rental=next.clients.find(c=>c.id==='c2')!.rentals[0];expect(rental.id).toBe(previous.id);expect(rental.monthly).toBe(previous.monthly);expect(rental.serial).not.toBe(previous.serial);
  expect(next.sales[0].total).toBe(0);expect(next.trips[0].stock.frio).toBe(0);expect(next.dispenserChanges![0].previousSerial).toBe(previous.serial);
  expect(demoOwnedStock(next,'frio').equipmentReturns).toBe(1);
  next.trips[0].stops.forEach(p=>{p.status='visited';});
  const closed=approveClose(closeTrip(next,'t1',next.trips[0].stock,'Retirado con daño'),'t1');
  expect(demoOwnedStock(closed,'frio').repair).toBe(1);expect(closed.products.find(p=>p.id==='frio')!.depot).toBe(s.products.find(p=>p.id==='frio')!.depot);
 });
 it('recibe el retirado bueno al depósito solo al aprobar rendición',()=>{
  const s=seedProgram(),next=recordVisit(s,{tripId:'t1',clientId:'c3',actorId:'owner',items:[],paid:'0',method:'Efectivo',dispenserChange:{rentalId:'loan-demo-3',productId:'frio',condition:'good'}});
  expect(next.clients.find(c=>c.id==='c3')!.rentals[0].mode).toBe('loan');
  next.trips[0].stops.forEach(p=>{p.status='visited';});
  const closed=approveClose(closeTrip(next,'t1',next.trips[0].stock,''),'t1');
  expect(closed.products.find(p=>p.id==='frio')!.depot).toBe(s.products.find(p=>p.id==='frio')!.depot+1);expect(demoOwnedStock(closed,'frio').equipmentReturns).toBe(0);
 });
 it('rechaza cambio sin stock y no toca un equipo propio ni la visita original',()=>{
  const s=seedProgram();s.trips[0].stock.frio=0;
  expect(()=>recordVisit(s,{tripId:'t1',clientId:'c2',actorId:'luz',items:[],paid:'0',method:'Efectivo',dispenserChange:{rentalId:'rent1',productId:'frio',condition:'good'}})).toThrow('reemplazo');
  expect(s.clients.find(c=>c.id==='c2')!.rentals[0].serial).toBe('FC-DEMO-021');expect(s.trips[0].stops[1].status).toBe('pending');
 });
});
