import {describe,it,expect} from 'vitest';
import {seedProgram} from './programDemo';
import {demoDashboard,demoTripProgress} from './dashboardDemo';
describe('tablero y avance de demo',()=>{
 it('suma costos una vez por carga y separa ganancia de cobrado',()=>{
  const s=seedProgram();s.trips[0].fillingCost={basis:'refilled',items:[],total:10000};s.trips[0].date='2026-10-19';s.trips[1].stage='approved';s.trips[1].date='2026-09-19';s.trips[1].fillingCost={basis:'refilled',items:[],total:5000};
  s.sales=[{id:'one',time:'10:00',date:'2026-10-19',tripId:'t1',clientId:'c1',actorId:'luz',items:[],rentalIds:[],rentalFee:0,total:50000,paid:0,method:'Efectivo',before:0,after:50000}];
  const d=demoDashboard(s);expect(d.sold).toBe(50000);expect(d.cost).toBe(10000);expect(d.profit).toBe(40000);expect(d.complete).toBe(true);expect(d.best?.date).toBe('2026-10-19');
 });
 it('no inventa ganancia ni mejor día si falta costo histórico',()=>{
  const d=demoDashboard(seedProgram());expect(d.complete).toBe(false);expect(d.best).toBeUndefined();expect(d.today?.complete).toBe(false);
 });
 it('entrega no se confunde con devolución, ausencia o cobro y cuenta altas únicas',()=>{
  const s=seedProgram();s.clients[0].joinedOn='2026-10-19';s.trips[0].stops[0].status='visited';s.trips[0].stops[1].status='tomorrow';
  s.sales=[{id:'one',time:'10:00',tripId:'t1',clientId:'c1',actorId:'luz',items:[{productId:'b20',quantity:0,returned:1,price:350000}],rentalIds:[],rentalFee:0,total:0,paid:0,method:'Efectivo',before:0,after:0}];
  expect(demoTripProgress(s,s.trips[0])).toEqual({delivered:0,total:3,resolved:2,newClients:1});s.sales[0].items[0].quantity=1;expect(demoTripProgress(s,s.trips[0]).delivered).toBe(1);
 });
});
