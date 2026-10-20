import {pendingDemoRecovery,type DemoProgramState,type Trip} from './programDemo';
export function routeLoadSuggestion(s:DemoProgramState,t:Pick<Trip,'stops'|'plannedEquipment'>){
 const quantities:Record<string,number>={},missing:string[]=[];
 for(const stop of t.stops){
  const c=s.clients.find(c=>c.id===stop.clientId&&c.active);
  if(!c||pendingDemoRecovery(s,c.id))continue;
  const extra=stop.extraVisitId?s.extraVisits?.find(v=>v.id===stop.extraVisitId):undefined;
  const items=extra?{[extra.productId]:extra.quantity}:c.usualItems;
  if(!items||!Object.values(items).some(n=>n>0))missing.push(c.name);
  for(const [id,n] of Object.entries(items||{})){if(s.products.some(p=>p.id===id&&p.active&&p.kind==='sale'))quantities[id]=(quantities[id]||0)+n;}
 }
 for(const [id,n] of Object.entries(t.plannedEquipment||{})){if(s.products.some(p=>p.id===id&&p.active&&p.kind==='rental'))quantities[id]=(quantities[id]||0)+n;}
 return {quantities,missing};
}
export function readRouteLoad(data:FormData,ids:string[]){
 const planned:Record<string,number>={},extras:Record<string,number>={},total:Record<string,number>={};
 for(const id of ids){
  planned[id]=Number(data.get(`planned-${id}`)||0);extras[id]=Number(data.get(`extra-${id}`)||0);total[id]=planned[id]+extras[id];
  if(![planned[id],extras[id],total[id]].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000))throw new Error('Revisá las cantidades previstas y extra de la carga.');
 }
 return {planned,extras,total};
}
