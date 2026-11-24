export type RouteVisitState={customer_id:string;name:string;position:number;outcome:string;followup?:string|null;next_date?:string|null;next_time?:string|null;closed_unvisited?:boolean};
export function routeVisitLabel(s:RouteVisitState){
 if(s.closed_unvisited)return s.outcome==='present'?'Atencion sin finalizar al cerrar':'Sin visitar al cerrar';
 if(s.outcome==='absent')return `No estaba${s.followup==='later_today'?' - volver mas tarde':s.next_date?` - volver el ${s.next_date.split('-').reverse().join('/')}`:''}${s.next_time?` a las ${s.next_time}`:''}`;
 return ({pending:'Sin visitar',present:'Atencion sin finalizar',no_purchase:'Estaba, no compro',delivered:'Atendido / entrega registrada'} as Record<string,string>)[s.outcome]||s.outcome;
}
export const routeVisitLines=(states?:RouteVisitState[])=>states?.length?['','ESTADO DE LAS PARADAS',...states.map(s=>`${s.position}. ${s.name}: ${routeVisitLabel(s)}`)]:[];
