import {describe,it,expect} from 'vitest';
import {loadTrip,seedProgram} from './programDemo';
import {readRouteLoad,routeLoadSuggestion} from './routeLoadDemo';
describe('carga recomendada y extras',()=>{
 it('suma pedidos estructurados y solo dispenser expresamente previstos',()=>{
  const s=seedProgram(),t=s.trips[0];t.plannedEquipment={frio:1};
  expect(routeLoadSuggestion(s,t)).toEqual({quantities:{b20:5,b12:2,frio:1},missing:[]});
  t.plannedEquipment={};expect(routeLoadSuggestion(s,t).quantities.frio).toBeUndefined();
 });
 it('visita adicional reemplaza el habitual de esa parada y advierte falta de cantidades',()=>{
  const s=seedProgram();s.extraVisits=[{id:'extra',clientId:'c1',date:'2026-10-19',productId:'b20',quantity:1,note:'',status:'assigned'}];
  s.trips[0].stops=[{clientId:'c1',status:'pending',extraVisitId:'extra'}];expect(routeLoadSuggestion(s,s.trips[0]).quantities).toEqual({b20:1});
  delete s.trips[0].stops[0].extraVisitId;delete s.clients[0].usualItems;
  expect(routeLoadSuggestion(s,s.trips[0])).toEqual({quantities:{},missing:['Elena Duarte']});
 });
 it('confirma previsto más extra una vez y congela desglose y costo de recarga',()=>{
  const s=seedProgram();s.trips[0].stage='planned';s.trips[0].plannedEquipment={frio:1};s.fillingCost={enabled:true};Object.assign(s.products[0],{depot:2,fillingCostEnabled:true,fillingCost:100});
  const next=loadTrip(s,'t1',{b20:10,b12:2,frio:2},true,'owner',{planned:{b20:5,b12:2,frio:1},extras:{b20:5,frio:1}});
  expect(next.trips[0].load).toEqual({b20:10,b12:2,frio:2});expect(next.trips[0].loadExtras).toEqual({b20:5,frio:1});
  expect(next.trips[0].loadRecommendation).toEqual({b20:5,b12:2,frio:1});expect(next.trips[0].fillingCost?.total).toBe(800);
  next.clients[0].usualItems={b20:99};expect(next.trips[0].loadRecommendation?.b20).toBe(5);
  expect(()=>loadTrip(next,'t1',{b20:1})).toThrow('todavía no comenzó');
  expect(()=>loadTrip(s,'t1',{b20:10},true,'owner',{planned:{b20:5},extras:{b20:2}})).toThrow('total');
 });
 it('suma campos del formulario y rechaza negativos, fracciones y overflow',()=>{
  const f=new FormData();f.set('planned-b20','5');f.set('extra-b20','3');expect(readRouteLoad(f,['b20']).total.b20).toBe(8);
  for(const bad of ['-1','0.5','100001']){f.set('extra-b20',bad);expect(()=>readRouteLoad(f,['b20'])).toThrow('cantidades');}
 });
});
