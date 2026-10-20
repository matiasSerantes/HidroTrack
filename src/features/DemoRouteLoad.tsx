import {useState} from 'react';
import type {Client,DemoProgramState,Trip} from '../domain/programDemo';
import {routeLoadSuggestion} from '../domain/routeLoadDemo';
export function DemoUsualItems({state:s,client}:{state:DemoProgramState;client?:Client}){
 return <fieldset className="customer-profile"><legend>Cantidades habituales para preparar el camión</legend><p>Estas cantidades permiten sugerir la carga del recorrido. La descripción escrita se conserva.</p>{s.products.filter(p=>p.active&&p.kind==='sale').map(p=><label key={p.id}>{p.name}<input aria-label={`Pedido habitual · ${p.name}`} name={`usual-${p.id}`} type="number" min="0" max="100000" defaultValue={client?.usualItems?.[p.id]||0}/></label>)}</fieldset>;
}
export function DemoLoadSuggestion({state:s,trip}:{state:DemoProgramState;trip:Pick<Trip,'stops'|'plannedEquipment'>}){
 const {quantities,missing}=routeLoadSuggestion(s,trip);
 return <section className="customer-profile" aria-label="Carga sugerida del recorrido"><h3>Se deberán cargar para este recorrido</h3>{s.products.filter(p=>(quantities[p.id]||0)>0).map(p=><p key={p.id}><strong>{p.name}: {quantities[p.id]}</strong></p>)}{!Object.values(quantities).some(n=>n>0)&&<p>Todavía no hay cantidades previstas.</p>}{missing.length>0&&<p role="status">Falta indicar cantidades habituales en la ficha de: {missing.join(', ')}. Revisá la carga antes de salir.</p>}<p>Los dispenser ya instalados no se vuelven a cargar. Indicá solo equipos nuevos o reemplazos previstos. Podés sumar extras antes de confirmar.</p></section>;
}
export function DemoLoadQuantities({state:s,trip,fill}:{state:DemoProgramState;trip:Trip;fill:boolean}){
 const suggestion=routeLoadSuggestion(s,trip).quantities;
 const [planned,setPlanned]=useState(suggestion),[extras,setExtras]=useState<Record<string,number>>({});
 return <div className="demo-load-quantities"><h3>Recorrido + extras</h3><p>Revisá lo previsto y sumá lo que llevás para nuevos clientes o imprevistos. Se registra todo junto al salir.</p>{s.products.filter(p=>p.active).map(p=>{
  const available=p.depot+(fill&&p.returnable&&p.kind==='sale'?(s.depotEmpties[p.id]||0):0),total=(planned[p.id]||0)+(extras[p.id]||0);
  return <section className="customer-profile" key={p.id}><h4>{p.name}</h4><p>Sugerido: {suggestion[p.id]||0} · disponibles: {available}</p><div className="hd-form-grid"><label>Para el recorrido<input aria-label={`Para el recorrido · ${p.name}`} name={`planned-${p.id}`} type="number" min="0" max="100000" required value={planned[p.id]||0} onChange={e=>setPlanned({...planned,[p.id]:Number(e.target.value)})}/></label><label>Carga extra<input aria-label={`Extra · ${p.name}`} name={`extra-${p.id}`} type="number" min="0" max="100000" required value={extras[p.id]||0} onChange={e=>setExtras({...extras,[p.id]:Number(e.target.value)})}/></label></div><strong>Total a cargar: {total}</strong>{total>available&&<p role="alert">No alcanza el stock disponible. Ajustá las cantidades o registrá el stock antes de salir.</p>}</section>;
 })}</div>;
}
