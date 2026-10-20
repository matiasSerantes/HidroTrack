import {demoDay,pendingDemoRecovery,uid,type DemoProgramState} from './programDemo';
export const visitWeekdays=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export type ExtraVisit={id:string;clientId:string;date:string;productId:string;quantity:number;note:string;status:'pending'|'assigned'|'completed';tripId?:string};
export type DispenserChange={id:string;clientId:string;tripId:string;previousProductId:string;previousSerial:string;productId:string;serial:string;condition:'good'|'damaged';date:string};
export function createExtraVisit(s:DemoProgramState,input:Omit<ExtraVisit,'id'|'status'>,actor:string){
 if(!s.members.some(m=>m.id===actor&&m.role==='owner'&&m.active))throw new Error('Solo el jefe puede generar una visita adicional.');
 if(!s.clients.some(c=>c.id===input.clientId&&c.active)||pendingDemoRecovery(s,input.clientId))throw new Error('El cliente no está habilitado para nuevas entregas.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||input.date<demoDay||new Date(input.date+'T12:00:00Z').toISOString().slice(0,10)!==input.date)throw new Error('Elegí una fecha válida desde el día de la demo.');
 if(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>100000||!s.products.some(p=>p.id===input.productId&&p.active&&p.kind==='sale'))throw new Error('Elegí un producto y una cantidad válida.');
 return {...s,extraVisits:[...(s.extraVisits||[]),{...input,id:uid(),status:'pending' as const}]};
}
export function assignExtraVisit(s:DemoProgramState,id:string,tripId:string,actor:string){
 if(!s.members.some(m=>m.id===actor&&m.role==='owner'&&m.active))throw new Error('Solo el jefe puede asignar visitas.');
 const next=structuredClone(s),visit=next.extraVisits?.find(v=>v.id===id),trip=next.trips.find(t=>t.id===tripId&&['planned','active'].includes(t.stage));
 if(!visit||visit.status!=='pending'||!trip)throw new Error('Elegí una visita pendiente y un reparto abierto.');
 if((trip.date||demoDay)!==visit.date)throw new Error('La fecha del reparto debe coincidir con la visita adicional.');
 if(pendingDemoRecovery(next,visit.clientId)||!next.clients.some(c=>c.id===visit.clientId&&c.active))throw new Error('El cliente no está habilitado para entregas.');
 if(trip.stops.some(p=>p.clientId===visit.clientId))throw new Error('Ese cliente ya figura en el reparto. Elegí otro para conservar ambas visitas.');
 trip.stops.push({clientId:visit.clientId,status:'pending',extraVisitId:visit.id});visit.status='assigned';visit.tripId=trip.id;return next;
}
