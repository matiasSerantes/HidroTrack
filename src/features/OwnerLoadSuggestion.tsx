import type {FillingSettings} from './OwnerFillingCosts';
import {currency} from '../domain/demo';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './OwnerLoadSuggestion.css';

type Product={id:string;name:string;unit:string;returnable?:boolean;family?:string};
type Suggestion={quantities:Record<string,number>;clients:number;withoutHabit:number};
export function OwnerLoadSuggestion({client,tenantId,tripId,products,available,fillingSettings,fillOnLoad=false,depotReady}:{client:SupabaseClient;tenantId:string;tripId:string;products:Product[];available:(id:string)=>number;fillingSettings?:FillingSettings;fillOnLoad?:boolean;depotReady?:(id:string)=>number}){
 const [suggestion,setSuggestion]=useState<Suggestion|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[quantities,setQuantities]=useState<Record<string,number>>({});
 useEffect(()=>{let active=true;setSuggestion(null);setError('');void (async()=>{
  if(!tripId)return;
  try{
   const stops=await client.from('route_stops').select('customer_id',{count:'exact'}).eq('tenant_id',tenantId).eq('trip_id',tripId).eq('active',true);
   if(stops.error||stops.count!==(stops.data?.length??0))throw new Error();
   const assigned=[...new Set((stops.data??[]).map(s=>s.customer_id))];
   if(!assigned.length){if(active)setSuggestion({quantities:{},clients:0,withoutHabit:0});return;}
   const customers=await client.from('customers').select('id',{count:'exact'}).eq('tenant_id',tenantId).eq('active',true).eq('pending_recovery',false).in('id',assigned);
   if(customers.error||customers.count!==(customers.data?.length??0))throw new Error();
   const eligible=(customers.data??[]).map(c=>c.id);
   if(!eligible.length){if(active)setSuggestion({quantities:{},clients:0,withoutHabit:0});return;}
   const extra=await client.from('extra_visit_requests').select('customer_id,items',{count:'exact'}).eq('tenant_id',tenantId).eq('trip_id',tripId).eq('state','assigned');
   if(extra.error||extra.count!==(extra.data?.length??0))throw new Error();
   const overrides=new Map<string,{product_id:string;quantity:number}[]>();
   for(const v of extra.data??[]){if(!eligible.includes(v.customer_id))continue;if(overrides.has(v.customer_id)||!Array.isArray(v.items))throw new Error();overrides.set(v.customer_id,v.items);}
   // Count + pagination avoids treating PostgREST's row limit as the whole list.
   const habits:{customer_id:string;product_id:string;quantity:number}[]=[];let expected:number|null=null;
   for(let offset=0;;){
    const page=await client.from('customer_product_preferences').select('customer_id,product_id,quantity',{count:'exact'}).eq('tenant_id',tenantId).in('customer_id',eligible).order('customer_id').order('product_id').range(offset,offset+499);
    if(page.error||page.count===null||page.count>100000||(expected!==null&&expected!==page.count))throw new Error();
    if(!active)return;
    expected=page.count;habits.push(...(page.data??[]));offset=habits.length;
    if(offset===expected)break;if(!(page.data?.length)||offset>expected)throw new Error();
   }
   const totals:Record<string,number>={},covered=new Set<string>(),validProducts=new Set(products.map(p=>p.id));
   const add=(customer:string,id:string,amount:number)=>{if(!validProducts.has(id))return;const q=Number(amount);if(!Number.isSafeInteger(q)||q<=0)throw new Error();totals[id]=(totals[id]??0)+q;covered.add(customer);};
   for(const h of habits){if(!overrides.has(h.customer_id))add(h.customer_id,h.product_id,h.quantity);}
   for(const [customer,items] of overrides){for(const item of items)add(customer,item.product_id,item.quantity);}
   if(active)setSuggestion({quantities:totals,clients:eligible.length,withoutHabit:eligible.length-covered.size});
  }catch{if(active)setError('No pudimos calcular la sugerencia. Podés actualizarla o ingresar la carga manualmente.');}
 })();return()=>{active=false;};},[client,tenantId,tripId,retry,products]);
 const selected=products.filter(p=>(quantities[p.id]??0)>0),total=selected.reduce((sum,p)=>sum+quantities[p.id],0);
 const costLines=fillingSettings?.enabled?fillingSettings.costs.filter(c=>products.some(p=>p.id===c.product_id&&p.returnable&&p.family==='article')).map(c=>({...c,quantity:fillOnLoad?Math.max((quantities[c.product_id]??0)-(depotReady?.(c.product_id)??0),0):0})).filter(c=>c.quantity>0):[];
 return <div className="load-suggestion"><section className="load-suggestion-summary"><h4>Carga sugerida del reparto</h4>{!tripId?<p>Elegí el reparto para calcular qué llevar.</p>:error?<p role="status">{error}</p>:!suggestion?<p role="status">Consultando pedidos habituales…</p>:<><p>{suggestion.clients} clientes activos para atender. Se usan sus cantidades habituales o su pedido extraordinario asignado (sin sumarlos dos veces); no se descuentan los envases que tienen para devolver.</p>{Object.entries(suggestion.quantities).map(([id,q])=><p key={id}><strong>{products.find(p=>p.id===id)?.name}</strong>: {q} unidades</p>)}{suggestion.withoutHabit>0&&<p className="load-suggestion-warning">{suggestion.withoutHabit} clientes sin cantidades habituales de estos productos. Completá su carga manualmente.</p>}{!Object.keys(suggestion.quantities).length&&<p>No hay cantidades habituales para sumar. Podés ingresar la carga abajo.</p>}<button type="button" disabled={!Object.keys(suggestion.quantities).length} onClick={()=>setQuantities({...suggestion.quantities})}>Usar carga sugerida</button></>}{tripId&&<button type="button" onClick={()=>setRetry(v=>v+1)}>Actualizar sugerencia</button>}<p>Es una referencia: usar la sugerencia reemplaza las cantidades ingresadas; después podés sumar extras. Cambiar de reparto limpia las cantidades sin confirmar. Se confirma una sola carga.</p></section>
  {fillingSettings?.enabled&&<section className="load-suggestion-summary"><h4>Costo de llenado previsto</h4><strong>{currency(-costLines.reduce((sum,c)=>sum+c.quantity*Number(c.unit_cost)*100,0))}</strong>{costLines.map(c=><p key={c.product_id}>{products.find(p=>p.id===c.product_id)?.name}: {c.quantity} a rellenar</p>)}<p>Solo productos con costo configurado y unidades rellenadas al cargar. El servidor confirma cantidades y costos vigentes; no es ganancia neta.</p></section>}
  <div className="stock-quantity-list"><div className="stock-quantity-head"><strong>Artículo</strong><span>Cantidad</span></div>{products.map(p=>{const recommended=suggestion?.quantities[p.id]??0,actual=quantities[p.id]??0;return <label className="stock-quantity-row" key={p.id}><span><strong>{p.name}</strong><small>{available(p.id)} disponibles en depósito</small>{suggestion&&<small>Sugeridos: {recommended} · Extras: {Math.max(actual-recommended,0)}{actual<recommended?` · Faltan: ${recommended-actual}`:''}</small>}</span><input aria-label={`Cargar ${p.name}`} name={p.id} type="number" inputMode="numeric" min="0" max={Math.min(available(p.id),100000)} step="1" value={actual} onChange={e=>setQuantities(q=>({...q,[p.id]:Number(e.target.value)}))}/></label>;})}<div className="stock-quantity-total"><span>{selected.length} artículos seleccionados</span><strong>{total} unidades</strong></div></div>
 </div>;
}
