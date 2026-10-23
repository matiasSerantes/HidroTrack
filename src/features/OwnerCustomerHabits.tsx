import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isDispenserModel } from './OwnerStockIncident';
import './OwnerCustomerHabits.css';

const weekdays=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
type Product={id:string;name:string;family?:string;active:boolean};
type Preference={product_id:string;quantity:number};
export function OwnerCustomerHabits({client,tenantId,customerId,createdAt,disabled,onLock}:{client:SupabaseClient;tenantId:string;customerId:string;createdAt?:string;disabled:boolean;onLock:(value:boolean)=>void}){
 const [days,setDays]=useState<number[]>([]),[preferences,setPreferences]=useState<Preference[]>([]),[products,setProducts]=useState<Product[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0),[product,setProduct]=useState(''),[quantity,setQuantity]=useState('');
 useEffect(()=>{onLock(busy);return()=>onLock(false);},[busy,onLock]);
 useEffect(()=>{let active=true;setReady(false);setProduct('');setQuantity('');void (async()=>{
  try{
   const [schedule,usual,catalog]=await Promise.all([
    client.from('customer_schedules').select('weekday').eq('tenant_id',tenantId).eq('customer_id',customerId),
    client.from('customer_product_preferences').select('product_id,quantity').eq('tenant_id',tenantId).eq('customer_id',customerId),
    client.from('products').select('id,name,family,active').eq('tenant_id',tenantId).order('name'),
   ]);
   if(schedule.error||usual.error||catalog.error)throw new Error();
   if(active){setDays((schedule.data??[]).map(d=>d.weekday));setPreferences(usual.data??[]);setProducts(catalog.data??[]);setReady(true);setError('');}
  }catch{if(active)setError('No pudimos verificar los días y cantidades. Actualizá antes de editar.');}
 })();return()=>{active=false;};},[client,tenantId,customerId,retry]);
 const locked=disabled||busy||!ready;
 async function toggleDay(day:number){
  if(locked)return;const removing=days.includes(day);setBusy(true);setMessage('');setError('');
  try{
   const result=removing?await client.from('customer_schedules').delete().eq('tenant_id',tenantId).eq('customer_id',customerId).eq('weekday',day).select('weekday'):await client.from('customer_schedules').upsert({tenant_id:tenantId,customer_id:customerId,weekday:day},{onConflict:'tenant_id,customer_id,weekday'}).select('weekday').single();
   if(result.error||(!removing&&!result.data))throw new Error();
   setDays(current=>removing?current.filter(d=>d!==day):[...new Set([...current,day])]);setMessage(`${weekdays[day-1]} ${removing?'quitado de':'agregado a'} la visita habitual.`);
  }catch{setReady(false);setError('No pudimos confirmar el día. Actualizá para consultar lo guardado antes de reintentar.');}
  finally{setBusy(false);}
 }
 async function saveQuantity(e:FormEvent){
  e.preventDefault();if(locked)return;const amount=Number(quantity);
  if(!product||!products.some(p=>p.id===product&&p.active&&!isDispenserModel(p))||!Number.isInteger(amount)||amount<0||amount>100000||quantity===''){setError('Elegí un producto y una cantidad entera entre 0 y 100000.');return;}
  setBusy(true);setMessage('');setError('');
  try{
   const r=amount===0?await client.from('customer_product_preferences').delete().eq('tenant_id',tenantId).eq('customer_id',customerId).eq('product_id',product).select('product_id'):await client.from('customer_product_preferences').upsert({tenant_id:tenantId,customer_id:customerId,product_id:product,quantity:amount},{onConflict:'tenant_id,customer_id,product_id'}).select('product_id,quantity').single();
   if(r.error||(amount>0&&!r.data))throw new Error();
   setPreferences(current=>[...current.filter(p=>p.product_id!==product),...(amount>0?[{product_id:product,quantity:amount}]:[])]);setMessage(amount?'Cantidad habitual guardada. No registra una entrega ni modifica stock.':'Cantidad habitual quitada.');
  }catch{setReady(false);setError('No pudimos confirmar la cantidad. Actualizá antes de reintentar.');}
  finally{setBusy(false);}
 }
 return <section className="customer-habits"><div className="section-heading"><div><h3>Visitas y pedido habitual</h3>{createdAt&&<p>Cliente desde {new Date(createdAt).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</p>}</div><button type="button" disabled={busy||disabled} onClick={()=>{setMessage('');setRetry(v=>v+1);}}>Actualizar hábitos</button></div>
  {error&&<p className="notice" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {!ready?<p>Consultando los hábitos del cliente…</p>:<><p>¿Qué días lo visitás? Tocá cada día para agregarlo o quitarlo; se guarda al momento.</p><div className="customer-weekdays">{weekdays.map((name,index)=><button key={name} type="button" aria-pressed={days.includes(index+1)} className={days.includes(index+1)?'selected':''} disabled={locked} onClick={()=>void toggleDay(index+1)}>{name}</button>)}</div>{!days.length&&<p>Sin día habitual definido.</p>}
   <h4>Lo que suele pedir</h4>{preferences.length?preferences.map(p=><p className="customer-usual-row" key={p.product_id}><strong>{products.find(item=>item.id===p.product_id)?.name||'Producto anterior'}</strong><span>{p.quantity} unidades por visita</span></p>):<p>Todavía no hay cantidades habituales registradas.</p>}
   <form onSubmit={saveQuantity}><fieldset disabled={locked}><div className="customer-habits-fields"><label>Producto habitual<select required value={product} onChange={e=>{setProduct(e.target.value);const saved=preferences.find(p=>p.product_id===e.target.value);setQuantity(saved?String(saved.quantity):'');}}><option value="">Elegí un producto</option>{products.filter(p=>p.active&&!isDispenserModel(p)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Unidades por visita<input type="number" inputMode="numeric" required min="0" max="100000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div><p>Es una referencia para preparar el reparto. Cero quita esa cantidad habitual; no cambia lo que el cliente tiene para devolver.</p><button className="primary">Guardar cantidad habitual</button></fieldset></form>
  </>}
 </section>;
}
