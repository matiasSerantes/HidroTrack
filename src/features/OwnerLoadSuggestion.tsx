import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './OwnerLoadSuggestion.css';

type Product={id:string;name:string;unit:string};
type Suggestion={quantities:Record<string,number>;clients:number;withoutHabit:number};
export function OwnerLoadSuggestion({client,tenantId,tripId,products,available}:{client:SupabaseClient;tenantId:string;tripId:string;products:Product[];available:(id:string)=>number}){
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
   for(const h of habits){if(!validProducts.has(h.product_id))continue;const q=Number(h.quantity);if(!Number.isSafeInteger(q)||q<=0)throw new Error();totals[h.product_id]=(totals[h.product_id]??0)+q;covered.add(h.customer_id);}
   if(active)setSuggestion({quantities:totals,clients:eligible.length,withoutHabit:eligible.length-covered.size});
  }catch{if(active)setError('No pudimos calcular la sugerencia. Podés actualizarla o ingresar la carga manualmente.');}
 })();return()=>{active=false;};},[client,tenantId,tripId,retry,products]);
 const selected=products.filter(p=>(quantities[p.id]??0)>0),total=selected.reduce((sum,p)=>sum+quantities[p.id],0);
 return <div className="load-suggestion"><section className="load-suggestion-summary"><h4>Carga sugerida del reparto</h4>{!tripId?<p>Elegí el reparto para calcular qué llevar.</p>:error?<p role="status">{error}</p>:!suggestion?<p role="status">Consultando pedidos habituales…</p>:<><p>{suggestion.clients} clientes activos para atender. Se suman sus cantidades habituales; no se descuentan los envases que tienen para devolver.</p>{Object.entries(suggestion.quantities).map(([id,q])=><p key={id}><strong>{products.find(p=>p.id===id)?.name}</strong>: {q} unidades</p>)}{suggestion.withoutHabit>0&&<p className="load-suggestion-warning">{suggestion.withoutHabit} clientes sin cantidades habituales de estos productos. Completá su carga manualmente.</p>}{!Object.keys(suggestion.quantities).length&&<p>No hay cantidades habituales para sumar. Podés ingresar la carga abajo.</p>}<button type="button" disabled={!Object.keys(suggestion.quantities).length} onClick={()=>setQuantities({...suggestion.quantities})}>Usar carga sugerida</button></>}{tripId&&<button type="button" onClick={()=>setRetry(v=>v+1)}>Actualizar sugerencia</button>}<p>Es una referencia: usar la sugerencia reemplaza las cantidades ingresadas; después podés sumar extras. Cambiar de reparto limpia las cantidades sin confirmar. Se confirma una sola carga.</p></section>
  <div className="stock-quantity-list"><div className="stock-quantity-head"><strong>Artículo</strong><span>Cantidad</span></div>{products.map(p=>{const recommended=suggestion?.quantities[p.id]??0,actual=quantities[p.id]??0;return <label className="stock-quantity-row" key={p.id}><span><strong>{p.name}</strong><small>{available(p.id)} disponibles en depósito</small>{suggestion&&<small>Sugeridos: {recommended} · Extras: {Math.max(actual-recommended,0)}{actual<recommended?` · Faltan: ${recommended-actual}`:''}</small>}</span><input aria-label={`Cargar ${p.name}`} name={p.id} type="number" inputMode="numeric" min="0" max={Math.min(available(p.id),100000)} step="1" value={actual} onChange={e=>setQuantities(q=>({...q,[p.id]:Number(e.target.value)}))}/></label>;})}<div className="stock-quantity-total"><span>{selected.length} artículos seleccionados</span><strong>{total} unidades</strong></div></div>
 </div>;
}
