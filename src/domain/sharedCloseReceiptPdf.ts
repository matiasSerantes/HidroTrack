import {createTextReceiptPdf,downloadPdf} from './textReceiptPdf';
export type SharedCloseReceipt={id:string;tenant_id:string;company:string;driver:string;trip:{id:string;name:string;date:string;status:string};closed_at:string;closure_state:string;declared_cash:number;declared_transfer?:number;sales?:number;initial_load:{product_id:string;name:string;loaded:number}[];stock:{product_id:string;name:string;family:string;ready:number;empties:number}[];declared_stock:{product_id:string;ready:number;empties:number}[];note?:string;decision_note?:string};
export type ReceiptRole='owner'|'driver';
const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n);
const validAmount=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=999999999999.99;
const validCount=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100000;
export function sharedCloseReceiptLines(h:SharedCloseReceipt,role:ReceiptRole){
 if(!['owner','driver'].includes(role)||!h.id||!h.company||!h.driver||!h.tenant_id||h.closure_state!=='approved'||h.trip?.status!=='closed'||!h.trip.id||!h.trip.name||!h.trip.date||!h.closed_at||!Number.isFinite(Date.parse(h.closed_at))||!validAmount(h.declared_cash)||!Array.isArray(h.initial_load)||!Array.isArray(h.stock)||!Array.isArray(h.declared_stock)||h.initial_load.some(p=>!p.name||!validCount(p.loaded))||h.stock.some(p=>!p.name||!validCount(p.ready)||!validCount(p.empties))||h.declared_stock.some(p=>!validCount(p.ready)||!validCount(p.empties))||h.stock.some(p=>!h.declared_stock.some(c=>c.product_id===p.product_id&&c.ready===p.ready&&c.empties===p.empties))||(role==='owner'&&(!validAmount(h.sales)||!validAmount(h.declared_transfer))))throw new Error('Comprobante aprobado incompleto. Actualizá antes de descargar.');
 const lines=[`Comprobante: ${h.id}`,`Empresa: ${h.company}`,`Repartidor: ${h.driver}`,`Recorrido: ${h.trip.name}`,`Fecha del reparto: ${h.trip.date}`,`Cierre aprobado: ${new Date(h.closed_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'})}`,'','EFECTIVO VALIDADO AL CIERRE',money(h.declared_cash),'Importe declarado por el asistente y aprobado por el jefe.'];
 if(role==='owner')lines.push('','VENTAS Y COBROS',`Ventas del reparto: ${money(h.sales!)}`,`Cobrado en efectivo: ${money(h.declared_cash)}`,`Transferencias declaradas: ${money(h.declared_transfer!)}`,`Total cobrado: ${money(h.declared_cash+h.declared_transfer!)}`,'Los cobros pueden incluir deudas anteriores. No son ganancia neta.','Las transferencias declaradas no son una conciliación bancaria.');
 lines.push('','CARGA INICIAL');
 for(const p of h.initial_load)lines.push(`${p.name}: ${p.loaded}`);
 if(!h.initial_load.length)lines.push('Sin unidades en el resumen de carga inicial.');
 lines.push('','REGRESO CONFIRMADO AL DEPÓSITO');
 for(const p of h.stock)lines.push(p.name,p.family==='dispenser'?`Unidades que vuelven: ${p.ready}`:`Llenos / unidades listas: ${p.ready} | Vacíos: ${p.empties}`);
 if(!h.stock.length)lines.push('Sin mercadería pendiente de regreso al cierre.');
 lines.push('','OBSERVACIONES',h.note||'Sin observaciones del asistente.',h.decision_note||'Sin observaciones del jefe.','','Comprobante interno aprobado. No es factura fiscal.','Datos guardados al rendir y aprobar; no se recalculan con el catálogo.','Este resumen no desglosa cambios ni series de dispenser.');
 return lines;
}
export function createSharedClosePdf(h:SharedCloseReceipt,role:ReceiptRole){return createTextReceiptPdf(sharedCloseReceiptLines(h,role),role==='owner'?'Copia del jefe - Cierre aprobado':'Copia del asistente - Cierre aprobado');}
export function downloadSharedClosePdf(h:SharedCloseReceipt,role:ReceiptRole){downloadPdf(createSharedClosePdf(h,role),`hidrotrack-cierre-${h.id.replace(/[^a-zA-Z0-9-]/g,'')}-${role}.pdf`);}
