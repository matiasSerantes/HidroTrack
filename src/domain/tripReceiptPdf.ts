import type {DemoTripReceipt} from './tripReceiptDemo';
const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);
import {createTextReceiptPdf,downloadPdf} from './textReceiptPdf';
export function receiptPdfLines(r:DemoTripReceipt,role:'owner'|'driver'){
 const lines=[`Comprobante: ${r.id}`,`Recorrido: ${r.tripName}`,`Empresa: ${r.company}`,`Repartidor: ${r.driver}`,`Fecha del reparto: ${r.date}`,`Cierre: ${new Date(r.closedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'})}`,'','EFECTIVO A RENDIR',money(r.cash),'Cobros en efectivo del reparto, incluidos saldos anteriores.','No confirma que el dinero haya sido recibido por el jefe.'];
 if(role==='owner')lines.push('','VENTAS Y COBROS',`Ventas registradas: ${money(r.sold)}`,`Cobrado en efectivo: ${money(r.cash)}`,`Cobrado por transferencia: ${money(r.transfer)}`,`Total cobrado: ${money(r.cash+r.transfer)}`,'Venta y cobro son importes distintos; puede haber deuda pendiente.');
 lines.push('','CARGA INICIAL Y REGRESO');
 for(const p of r.stock)lines.push(p.name,`Carga inicial: ${p.initial} | Llenos/unidades que vuelven: ${p.returnedFull}`,`Envases vacios que vuelven: ${p.returnedEmpty} | Dispenser nuevos entregados: ${p.dispensersDelivered}`,'');
 lines.push('DISPENSER CAMBIADOS Y RETIRADOS');
 if(!r.changes.length)lines.push('Sin cambios de dispenser registrados.');
 for(const c of r.changes)lines.push(`Retirado: ${c.previous}`,`Reemplazo entregado: ${c.replacement}`,`Estado retirado: ${c.condition}`,'');
 lines.push('OBSERVACIONES',r.note||'Sin observaciones.','','DEMO - Datos ficticios. Comprobante interno de rendicion.');
 return lines;
}
export function createTripReceiptPdf(r:DemoTripReceipt,role:'owner'|'driver'):Uint8Array{
 return createTextReceiptPdf(receiptPdfLines(r,role),`${role==='owner'?'Copia del jefe':'Copia del asistente'} - DEMO`);
}
export function downloadTripReceipt(r:DemoTripReceipt,role:'owner'|'driver'){
 downloadPdf(createTripReceiptPdf(r,role),`hidrotrack-${r.tripId}-${role}.pdf`);
}
