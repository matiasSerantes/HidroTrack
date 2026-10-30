import {it,expect} from 'vitest';
import {routeBlockCustomers,nearbyRouteStops,streetBlock} from '../src/domain/routeNearby';
const stop=(id,address,extra={})=>({id,name:id,address,locality:'Ciudad',latitude:-34.6,longitude:-58.4,outcome:'pending',...extra});
it('agrupa misma calle y centena, ordena alturas y distingue localidad',()=>{
 const a=stop('a','San Martín 8771'),b=stop('b','SAN MARTIN 8741'),c=stop('c','San Martín 8801'),d=stop('d','San Martín 8750',{locality:'Otra ciudad'});
 expect(routeBlockCustomers([a,b,c,d],a).map(s=>s.id)).toEqual(['b','a']);
 expect(streetBlock('9 de Julio 100')).toEqual({street:'9 de julio',number:100,block:1});
 expect(streetBlock('Sin altura')).toBeNull();
});
it('sin localidad exige puntos cercanos y no adivina direccion ambigua',()=>{
 const a=stop('a','Iguazú 8771',{locality:''}),b=stop('b','Iguazu 8741',{locality:''}),far=stop('c','Iguazu 8742',{locality:'',latitude:-35}),missing=stop('d','Iguazu 8743',{locality:'',latitude:null});
 expect(routeBlockCustomers([a,b,far,missing],a).map(s=>s.id)).toEqual(['b','a']);
 expect(routeBlockCustomers([a,missing],missing)).toEqual([missing]);
});
it('GPS preciso y fresco sugiere paradas pendientes cercanas, sin marcar visita',()=>{
 const a=stop('a','Calle 100'),resolved=stop('b','Calle 101',{outcome:'delivered'}),later=stop('c','Calle 102',{outcome:'absent',followup:'later_today'}),next=stop('d','Calle 103',{outcome:'absent',followup:'another_day'}),far=stop('e','Otra 1',{latitude:-35});
 const stops=[a,resolved,later,next,far],before=structuredClone(stops);
 expect(nearbyRouteStops(stops,{latitude:-34.6,longitude:-58.4,accuracy:20,timestamp:10000},10001).map(s=>s.stop.id)).toEqual(['a','c']);
 expect(stops).toEqual(before);
});
it('no sugiere llegada con mala precision, muestra vieja o coordenadas invalidas',()=>{
 const p={latitude:-34.6,longitude:-58.4,accuracy:20,timestamp:10000};
 for(const override of [{accuracy:51},{accuracy:-1},{timestamp:0},{latitude:NaN},{longitude:181},{timestamp:90000}])expect(nearbyRouteStops([stop('a','Calle 1')],{...p,...override},40000)).toEqual([]);
});
