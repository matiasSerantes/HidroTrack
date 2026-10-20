import {describe,it,expect} from 'vitest';
import {loadTrip,recordVisit,seedProgram} from './programDemo';
import {fillingCostPreview,setProductFillingCost,tripFillingResult} from './fillingCostDemo';

function prepared(){
 const s=seedProgram();s.fillingCost={enabled:true};s.trips[0].stage='planned';s.trips[0].load={};s.trips[0].stock={};
 const p=s.products.find(p=>p.id==='b20')!;Object.assign(p,setProductFillingCost(p,true,10000));p.depot=2;s.depotEmpties.b20=10;return s;
}
describe('llenado opcional y resultado del reparto · demo',()=>{
 it('solo cuenta los tres rellenados, excluye los dos llenos existentes y conserva el costo histórico',()=>{
  const s=prepared(),next=loadTrip(s,'t1',{b20:5},true,'owner'),trip=next.trips[0];
  expect(trip.fillingCost).toMatchObject({basis:'refilled',total:30000,items:[{productId:'b20',quantity:3,unitCost:10000}]});
  expect(tripFillingResult(next,trip)).toEqual({sold:0,cost:30000,result:-30000});
  next.products.find(p=>p.id==='b20')!.fillingCost=99999;next.fillingCost={enabled:false};
  expect(trip.fillingCost?.total).toBe(30000);expect(s.depotEmpties.b20).toBe(10);
  expect(()=>loadTrip(next,'t1',{b20:5},true,'owner')).toThrow('todavía no comenzó');
  expect(next.trips[0].fillingCost?.total).toBe(30000);
 });
 it('no imputa llenos existentes, costo desactivado ni productos sin costo',()=>{
  const s=prepared();expect(loadTrip(s,'t1',{b20:2}).trips[0].fillingCost?.total).toBe(0);
  s.fillingCost={enabled:false};expect(loadTrip(s,'t1',{b20:5},true).trips[0].fillingCost).toBeUndefined();
  s.fillingCost={enabled:true};s.products.find(p=>p.id==='b20')!.fillingCostEnabled=false;
  expect(loadTrip(s,'t1',{b20:5},true).trips[0].fillingCost?.total).toBe(0);
 });
 it('distingue venta y cobro sin computar deuda previa como ganancia',()=>{
  const s=loadTrip(prepared(),'t1',{b20:5},true);
  const next=recordVisit(s,{tripId:'t1',clientId:'c1',actorId:'luz',items:[{productId:'b20',quantity:1,returned:0}],paid:'8300',method:'Efectivo'});
  expect(tripFillingResult(next,next.trips[0])).toEqual({sold:350000,cost:30000,result:320000});
  expect(next.sales[0].paid).toBe(830000);
 });
 it('no admite costo de dispenser, negativo, overflow o recarga imposible',()=>{
  const s=prepared();expect(()=>setProductFillingCost(s.products.find(p=>p.id==='frio')!,true,100)).toThrow('dispenser');
  expect(()=>setProductFillingCost(s.products[0],true,-1)).toThrow('válido');
  s.products[0].fillingCost=Number.MAX_SAFE_INTEGER;expect(()=>fillingCostPreview(s,{b20:5},true)).toThrow('rango');
  s.products[0].fillingCost=100;s.depotEmpties.b20=0;expect(()=>loadTrip(s,'t1',{b20:5},true)).toThrow('vacíos');
  expect(s.trips[0].fillingCost).toBeUndefined();expect(s.trips[0].stage).toBe('planned');
 });
});
