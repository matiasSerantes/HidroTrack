import {useState,type FormEvent} from 'react';
import {currency,parseMoney} from '../domain/demo';

export type FillingSettings={enabled:boolean;costs:{product_id:string;unit_cost:number}[]};
export type LoadSnapshot={id:string;trip_id:string;trip_name:string;occurred_on:string;cost_enabled:boolean;filling_total:number;items:{product_id:string;name:string;unit:string;suggested:number;loaded:number;extra:number;missing:number;refilled:number;unit_cost:number|null;filling_cost:number|null}[]};
type Product={id:string;name:string;active:boolean;returnable:boolean;family?:string};
type Command={name:string;args:Record<string,unknown>;message:string};
export function OwnerFillingCosts({tenantId,products,settings,locked,onSubmit}:{tenantId:string;products:Product[];settings:FillingSettings;locked:boolean;onSubmit:(command:Command)=>void}){
 const [enabled,setEnabled]=useState(settings.enabled),[selected,setSelected]=useState(()=>new Set(settings.costs.map(c=>c.product_id))),[error,setError]=useState('');
 const eligible=products.filter(p=>p.active&&p.returnable&&p.family==='article');
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked)return;
  try{const f=new FormData(e.currentTarget),costs=eligible.filter(p=>selected.has(p.id)).map(p=>({product_id:p.id,unit_cost:parseMoney(String(f.get(p.id)))/100}));
   if(costs.some(c=>c.unit_cost>100000000))throw new Error();
   setError('');onSubmit({name:'owner_set_filling_costs',args:{p_tenant:tenantId,p_enabled:enabled,p_costs:costs},message:'Configuración de llenado guardada. Se aplicará a las próximas cargas; el historial se conserva.'});
  }catch{setError('Revisá los costos: usá importes positivos o cero, con hasta dos decimales.');}
 }
 return <section className="stock-panel"><h3>Configuración del costo de llenado</h3><form onSubmit={submit}><fieldset disabled={locked}><label className="stock-check"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Controlar costo de llenado</label><p>Solo cuenta lo que se rellena al cargar el camión. Los bidones que ya estaban llenos no agregan este gasto. Elegí los productos que querés controlar; los dispenser no tienen costo de llenado.</p>
 {eligible.map(p=><div key={p.id}><label className="stock-check"><input type="checkbox" checked={selected.has(p.id)} onChange={e=>setSelected(prev=>{const next=new Set(prev);if(e.target.checked)next.add(p.id);else next.delete(p.id);return next;})}/>Registrar costo de {p.name}</label>{selected.has(p.id)&&<label>Costo por llenado de {p.name} ($)<input name={p.id} inputMode="decimal" required defaultValue={String(settings.costs.find(c=>c.product_id===p.id)?.unit_cost??0)}/></label>}</div>)}
 {!eligible.length&&<p>Agregá un producto retornable en Catálogo para indicar su costo.</p>}{error&&<p role="alert">{error}</p>}<button className="primary">Guardar configuración de llenado</button></fieldset></form><p>Desactivarlo conserva los costos de cargas anteriores. Este gasto parcial no incluye combustible, sueldos ni otros gastos y no representa ganancia neta.</p></section>;
}
export function OwnerLoadHistory({snapshots}:{snapshots:LoadSnapshot[]}){
 return <section className="stock-panel"><h3>Detalle histórico de las últimas cargas</h3><p>Se conservan nombres, sugerencia al confirmar y costos de ese momento. Las cargas anteriores a esta función no se reconstruyen.</p>{!snapshots.length&&<p>Todavía no hay cargas con este detalle histórico.</p>}{snapshots.map(s=><article key={s.id}><h4>{s.trip_name} · {s.occurred_on}</h4><p>{s.cost_enabled?`Gasto parcial de llenado: ${currency(-Number(s.filling_total)*100)}`:'Esta carga se confirmó sin control de costo de llenado.'}</p>{s.items.map(i=><div key={i.product_id}><strong>{i.name}</strong><p>Sugeridos: {i.suggested} · Cargados: {i.loaded} · Extras: {i.extra} · Faltantes: {i.missing}</p><p>Rellenados al cargar: {i.refilled}{s.cost_enabled?(i.unit_cost===null?' · Sin costo configurado':` · ${currency(Number(i.unit_cost)*100)} por unidad · Gasto ${currency(Number(i.filling_cost)*100)}`):''}</p></div>)}</article>)}</section>;
}
