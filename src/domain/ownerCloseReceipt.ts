import {createTextReceiptPdf,downloadPdf} from './textReceiptPdf';

export type OwnerCloseSnapshot={id?:string;closed_at?:string;note?:string;trip:{id:string;name:string;date:string;status:string};cash:number;transfer:number;sales:number;pending_visits:number;equipment_count:number;pending_closure:boolean;stock:{product_id:string;name:string;family:string;ready:number;empties:number}[];initial_load:{product_id:string;name:string;loaded:number}[]};
const money=(value:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value);
const validQuantity=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100000;
const validMoney=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=999999999999.99;
export function ownerCloseReceiptLines(h:OwnerCloseSnapshot,tenantId:string):string[]{
 if(!h.id||!h.closed_at||!Number.isFinite(Date.parse(h.closed_at))||h.trip?.status!=='closed'||!h.trip.id||!h.trip.name||!h.trip.date||!tenantId||![h.cash,h.transfer,h.sales].every(validMoney)||!Array.isArray(h.initial_load)||!Array.isArray(h.stock)||h.initial_load.some(p=>!p.name||!validQuantity(p.loaded))||h.stock.some(p=>!p.name||!validQuantity(p.ready)||!validQuantity(p.empties)))throw new Error('El cierre no contiene un resumen válido para descargar. Actualizá los cierres.');
 const lines=[`Comprobante: ${h.id}`,`Empresa (ID): ${tenantId}`,`Recorrido: ${h.trip.name}`,`ID del reparto: ${h.trip.id}`,`Fecha del reparto: ${h.trip.date}`,`Cerrado: ${new Date(h.closed_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'})}`,'','VENTAS Y COBROS',`Ventas registradas: ${money(h.sales)}`,`Efectivo registrado en el cierre: ${money(h.cash)}`,`Transferencias declaradas: ${money(h.transfer)}`,`Total cobrado: ${money(h.cash+h.transfer)}`,'Los cobros incluyen saldos anteriores cobrados en este recorrido.','Ventas y cobros son importes distintos. No representan ganancia neta.','Las transferencias declaradas no son una conciliación bancaria.','','CARGA INICIAL'];
 for(const p of h.initial_load)lines.push(`${p.name}: ${p.loaded}`);
 if(!h.initial_load.length)lines.push('Sin unidades en el resumen de carga inicial.');
 lines.push('','REGRESO CONFIRMADO AL DEPÓSITO');
 for(const p of h.stock){lines.push(p.name,p.family==='dispenser'?`Unidades disponibles que vuelven: ${p.ready}`:`Llenos / unidades listas: ${p.ready} | Vacíos: ${p.empties}`);}
 if(!h.stock.length)lines.push('Sin mercadería pendiente de regreso al cierre.');
 lines.push('','OBSERVACIONES',h.note||'Sin observaciones.','','Comprobante interno del reparto propio del jefe. No es factura fiscal.','Cantidades e importes del resumen guardado al cerrar.','Este resumen no desglosa cambios ni series de dispenser.');
 return lines;
}
export function createOwnerClosePdf(h:OwnerCloseSnapshot,tenantId:string){return createTextReceiptPdf(ownerCloseReceiptLines(h,tenantId),'Copia del jefe - Cierre propio');}
export function downloadOwnerClosePdf(h:OwnerCloseSnapshot,tenantId:string){downloadPdf(createOwnerClosePdf(h,tenantId),`hidrotrack-cierre-${h.id!.replace(/[^a-zA-Z0-9-]/g,'')}.pdf`);}
