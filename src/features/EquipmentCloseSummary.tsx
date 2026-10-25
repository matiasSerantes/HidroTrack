import {equipmentCloseLines,type EquipmentCloseDetail} from '../domain/equipmentCloseDetail';
export function EquipmentCloseSummary({detail}:{detail?:EquipmentCloseDetail|null}){
 if(detail==null)return null;
 try{const lines=equipmentCloseLines(detail);return <section><h4>Movimientos de dispenser</h4>{lines.slice(1).map((line,i)=><p key={i}>{line}</p>)}</section>;}catch{return <p role="alert">No pudimos verificar el detalle de dispenser. Actualizá el resumen.</p>;}
}
