import {useState} from 'react';
import {currency} from '../domain/demo';
import type {DemoProgramState,Product,Trip} from '../domain/programDemo';
import {tripFillingResult,type FillingCostSnapshot} from '../domain/fillingCostDemo';

export function DemoFillingSettings({state:s,onChange}:{state:DemoProgramState;onChange:(fn:(s:DemoProgramState)=>DemoProgramState)=>void}){
 return <section className="hd-card"><h2>Configuración de llenado</h2><label className="hd-check"><input type="checkbox" checked={s.fillingCost?.enabled||false} onChange={e=>{const enabled=e.target.checked;onChange(state=>({...state,fillingCost:{enabled}}));}}/>Controlar costo de llenado y ganancia estimada</label><p className="hd-help">Opcional. Al activarlo, editá cada producto del Catálogo para indicar su costo unitario. Solo se descuentan los envases que se rellenan al cargar; los que ya estaban llenos no suman gasto. Se aplica a nuevas cargas y conserva los costos históricos al desactivarlo.</p></section>;
}
export function DemoProductFillingFields({product}:{product?:Product}){
 const [enabled,setEnabled]=useState(product?.fillingCostEnabled||false);
 return <div className="hd-filling-fields"><label className="hd-check"><input type="checkbox" name="filling_enabled" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Este producto tiene costo de llenado</label>{enabled&&<label className="hd-field"><span>Costo unitario de llenado ($)</span><input name="filling_cost" inputMode="decimal" required defaultValue={((product?.fillingCost||0)/100).toFixed(2)}/></label>}<p className="hd-help">Es el costo de rellenar un envase retornable, separado del precio de venta. No se aplica a dispenser.</p></div>;
}
export function DemoFillingEstimate({snapshot}:{snapshot?:FillingCostSnapshot}){
 return <div className="hd-filling-cost" role="status"><strong>Costo de llenado de esta carga: {currency(snapshot?.total?-snapshot.total:0)}</strong>{snapshot?.items.map(item=><p key={item.productId}>{item.name}: {item.quantity} a rellenar × {currency(item.unitCost)}</p>)}<p>Solo cuenta el faltante que se rellena con vacíos al cargar. Se confirma junto con la carga, sin duplicar el gasto.</p></div>;
}
export function DemoTripFillingResult({state:s,trip}:{state:DemoProgramState;trip:Trip}){
 if(!trip.fillingCost)return s.fillingCost?.enabled&&trip.stage!=='planned'?<p className="hd-help">Este reparto comenzó sin registro de costo de llenado. No se calcula su ganancia retroactivamente.</p>:null;
 const result=tripFillingResult(s,trip);
 return <section className="hd-filling-cost" aria-label="Resultado de llenado del reparto"><h3>Ganancia estimada del reparto</h3><div className="hd-filling-totals"><p>Vendido en entregas<strong>{currency(result.sold)}</strong></p><p>Costo de llenado al cargar<strong>{currency(trip.fillingCost.total?-trip.fillingCost.total:0)}</strong></p><p>Resultado estimado<strong className={result.result!<0?'hd-debt':''}>{currency(result.result!)}</strong></p></div>{trip.fillingCost.items.map(item=><p key={item.productId}>{item.name}: {item.quantity} rellenados × {currency(item.unitCost)}</p>)}<p className="hd-help">Vendido menos el llenado realizado en esta carga. Incluye ventas pendientes de cobro; no equivale a dinero cobrado ni a ganancia neta. Excluye combustible, sueldos, recargas anteriores y otros gastos.</p></section>;
}
