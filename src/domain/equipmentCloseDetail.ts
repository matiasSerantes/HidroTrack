export type EquipmentCloseEvent={id:string;date:string;kind:'assigned'|'exchanged'|'returned'|'damaged'|'removed'|'loaded'|'moved';name:string;quantity:number;replacement?:string;state?:'good'|'broken';serial?:string};
export type EquipmentCloseDetail={version:1;models:EquipmentCloseEvent[];serialized:EquipmentCloseEvent[]};
const labels:Record<EquipmentCloseEvent['kind'],string>={assigned:'Entregado / asignado',exchanged:'Cambio',returned:'Regreso',damaged:'Rotura / baja',removed:'Retiro de inventario',loaded:'Carga de equipo',moved:'Traslado a otro camión'};
export function equipmentCloseLines(detail?:EquipmentCloseDetail|null):string[]{
 if(detail==null)return ['Este resumen no desglosa cambios ni series de dispenser.'];
 if(detail.version!==1||!Array.isArray(detail.models)||!Array.isArray(detail.serialized))throw new Error('Detalle de dispenser incompleto.');
 const lines=['DISPENSER · MOVIMIENTOS DEL REPARTO'];
 for(const [heading,events] of [['Por modelo',detail.models],['Equipos identificados',detail.serialized]] as const){
  if(!events.length)continue;lines.push(heading);
  for(const e of events){
   if(!e.id||!e.name||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Object.hasOwn(labels,e.kind)||!Number.isSafeInteger(e.quantity)||e.quantity<1||e.quantity>100000||(e.kind==='exchanged'&&(!e.replacement||!['good','broken'].includes(e.state??''))))throw new Error('Movimiento de dispenser incompleto.');
   lines.push(`${e.date} · ${labels[e.kind]}: ${e.name} · ${e.quantity} unidad(es)`);
   if(e.serial)lines.push(`Identificación: ${e.serial}`);
   if(e.kind==='exchanged')lines.push(`Reemplazo entregado: ${e.replacement}`,e.state==='good'?'Retirado en buen estado: vuelve disponible en el camión.':'Retirado roto: baja definitiva; no suma disponibilidad.');
  }
 }
 if(!detail.models.length&&!detail.serialized.length)lines.push('Sin movimientos de dispenser vinculados a este reparto.');
 lines.push('Solo operaciones vinculadas al reparto. No se suman otra vez al regreso.');
 return lines;
}
