import {demoDay,uid,type DemoProgramState} from './programDemo';
export type StockEvent={id:string;productId:string;quantity:number;kind:'add'|'remove'|'damage';source:'depot_ready'|'depot_empty'|'truck_ready'|'truck_empty'|'customer_held';tripId?:string;customerId?:string;date:string;registeredAt:string;actorId:string;involvedKind:'owner'|'driver'|'customer';involvedId:string;note:string};
export function recordDemoStock(state:DemoProgramState,input:Omit<StockEvent,'id'|'registeredAt'>):DemoProgramState{
  if(input.actorId!=='owner')throw new Error('Solo el jefe registra ajustes de stock.');
  if(!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>100000)throw new Error('Cantidad inválida.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||input.date>demoDay||Number.isNaN(Date.parse(input.date))||new Date(`${input.date}T12:00:00Z`).toISOString().slice(0,10)!==input.date)throw new Error('Fecha inválida o futura.');
  if(!input.note.trim())throw new Error('Indicá el motivo.');
  if(input.involvedKind==='customer'?!state.clients.some(c=>c.id===input.involvedId):!state.members.some(m=>m.id===input.involvedId&&m.active&&(input.involvedKind==='owner'?m.role==='owner':m.role==='driver')))throw new Error('Persona no válida.');
  if(!['add','remove','damage'].includes(input.kind))throw new Error('Movimiento inválido.');
  if(input.kind==='add'&&!['depot_ready','depot_empty'].includes(input.source))throw new Error('Las compras ingresan al depósito.');
  const s=structuredClone(state),p=s.products.find(p=>p.id===input.productId);
  if(!p)throw new Error('Artículo no válido.');
  const delta=input.kind==='add'?input.quantity:-input.quantity;
  if(input.source==='depot_ready'){
    if(p.depot+delta<0)throw new Error('Stock insuficiente.');p.depot+=delta;
  }else if(input.source==='depot_empty'){
    if(!p.returnable||(s.depotEmpties[p.id]||0)+delta<0)throw new Error('Vacíos insuficientes o artículo no retornable.');s.depotEmpties[p.id]=(s.depotEmpties[p.id]||0)+delta;
  }else if(input.source==='truck_ready'||input.source==='truck_empty'){
    const t=s.trips.find(t=>t.id===input.tripId&&['active','submitted'].includes(t.stage));if(!t)throw new Error('Reparto no válido.');
    const bucket=input.source==='truck_ready'?t.stock:t.empties;if((bucket[p.id]||0)+delta<0)throw new Error('Stock insuficiente.');bucket[p.id]=(bucket[p.id]||0)+delta;
  }else if(input.source==='customer_held'){
    const c=s.clients.find(c=>c.id===input.customerId);if(!c||(c.held[p.id]||0)+delta<0)throw new Error('Envases insuficientes en el cliente.');c.held[p.id]=(c.held[p.id]||0)+delta;
  }else throw new Error('Ubicación inválida.');
  s.stockEvents=[{...input,id:uid(),registeredAt:new Date().toISOString()},...(s.stockEvents||[])];return s;
}
