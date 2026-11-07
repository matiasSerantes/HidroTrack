import {currency} from '../domain/demo';
import type {SaleCombo} from '../domain/saleCombos';
import {CustomerVisitWindow} from './CustomerVisitWindow';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isDispenserModel } from './OwnerStockIncident';
import './OwnerCustomerHabits.css';

const weekdays=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
type Product={id:string;name:string;family?:string;active:boolean};
type Preference={product_id:string;quantity:number};
export function OwnerCustomerHabits({client,tenantId,customerId,createdAt,disabled,onLock,onChanged}:{client:SupabaseClient;tenantId:string;customerId:string;createdAt?:string;onChanged?:()=>void;disabled:boolean;onLock:(value:boolean)=>void}){
 const [days,setDays]=useState<number[]>([]),[preferences,setPreferences]=useState<Preference[]>([]),[products,setProducts]=useState<Product[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0),[product,setProduct]=useState(''),[quantity,setQuantity]=useState('');
 const [comboPreferences,setComboPreferences]=useState<{combo_id:string;quantity:number}[]>([]),[combos,setCombos]=useState<SaleCombo[]>([]);
 const [windowBusy,setWindowBusy]=useState(false);
 useEffect(()=>{onLock(busy||windowBusy);return()=>onLock(false);},[busy,windowBusy,onLock]);
 useEffect(()=>{let active=true;setReady(false);setProduct('');setQuantity('');void (async()=>{
  try{
   const [schedule,usual,catalog,comboUsual,comboCatalog]=await Promise.all([
    client.from('customer_schedules').select('weekday').eq('tenant_id',tenantId).eq('customer_id',customerId),
    client.from('customer_product_preferences').select('product_id,quantity').eq('tenant_id',tenantId).eq('customer_id',customerId),
    client.from('products').select('id,name,family,active').eq('tenant_id',tenantId).order('name'),
    client.from('customer_combo_preferences').select('combo_id,quantity').eq('tenant_id',tenantId).eq('customer_id',customerId),
    client.from('sale_combos').select('*').eq('tenant_id',tenantId).order('name'),
   ]);
   if(schedule.error||usual.error||catalog.error||comboUsual.error||comboCatalog.error)throw new Error();
   if(active){setDays((schedule.data??[]).map(d=>d.weekday));setPreferences(usual.data??[]);setProducts(catalog.data??[]);setComboPreferences(comboUsual.data??[]);setCombos(comboCatalog.data??[]);setReady(true);setError('');}
  }catch{if(active)setError('No pudimos verificar los días y cantidades. Actualizá antes de editar.');}
 })();return()=>{active=false;};},[client,tenantId,customerId,retry]);
 const locked=disabled||busy||windowBusy||!ready;
 async function toggleDay(day:number){
  if(locked)return;const removing=days.includes(day);setBusy(true);setMessage('');setError('');
  try{
   const result=removing?await client.from('customer_schedules').delete().eq('tenant_id',tenantId).eq('customer_id',customerId).eq('weekday',day).select('weekday'):await client.from('customer_schedules').upsert({tenant_id:tenantId,customer_id:customerId,weekday:day},{onConflict:'tenant_id,customer_id,weekday'}).select('weekday').single();
   if(result.error||(!removing&&!result.data))throw new Error();
   onChanged?.();setDays(current=>removing?current.filter(d=>d!==day):[...new Set([...current,day])]);setMessage(`${weekdays[day-1]} ${removing?'quitado de':'agregado a'} la visita habitual.`);
  }catch{setReady(false);setError('No pudimos confirmar el día. Actualizá para consultar lo guardado antes de reintentar.');}
  finally{setBusy(false);}
 }
 async function saveQuantity(e:FormEvent){
  e.preventDefault();if(locked)return;const amount=Number(quantity);
  const isCombo=product.startsWith('combo:'),id=isCombo?product.slice(6):product;
  if(isCombo){if(!Number.isInteger(amount)||amount<0||amount>100000||quantity===''||!combos.some(c=>c.id===id&&(c.active||amount===0))){setError('Elegí una promo activa y una cantidad entera.');return;}setBusy(true);setError('');setMessage('');try{const r=amount===0?await client.from('customer_combo_preferences').delete().eq('tenant_id',tenantId).eq('customer_id',customerId).eq('combo_id',id).select('combo_id'):await client.from('customer_combo_preferences').upsert({tenant_id:tenantId,customer_id:customerId,combo_id:id,quantity:amount},{onConflict:'tenant_id,customer_id,combo_id'}).select('combo_id,quantity').single();if(r.error||(amount>0&&!r.data))throw new Error();setComboPreferences(current=>[...current.filter(p=>p.combo_id!==id),...(amount>0?[{combo_id:id,quantity:amount}]:[])]);setMessage(amount?'Promo habitual guardada. La carga sugerida usa sus bidones, sin registrar venta ni deuda.':'Promo habitual quitada.');onChanged?.();}catch{setReady(false);setError('No pudimos confirmar la promo habitual. Actualizá antes de reintentar.');}finally{setBusy(false);}return;}
  if(!product||!products.some(p=>p.id===product&&p.active&&!isDispenserModel(p))||!Number.isInteger(amount)||amount<0||amount>100000||quantity===''){setError('Elegí un producto y una cantidad entera entre 0 y 100000.');return;}
  setBusy(true);setMessage('');setError('');
  try{
   const r=amount===0?await client.from('customer_product_preferences').delete().eq('tenant_id',tenantId).eq('customer_id',customerId).eq('product_id',product).select('product_id'):await client.from('customer_product_preferences').upsert({tenant_id:tenantId,customer_id:customerId,product_id:product,quantity:amount},{onConflict:'tenant_id,customer_id,product_id'}).select('product_id,quantity').single();
   if(r.error||(amount>0&&!r.data))throw new Error();
   setPreferences(current=>[...current.filter(p=>p.product_id!==product),...(amount>0?[{product_id:product,quantity:amount}]:[])]);setMessage(amount?'Cantidad habitual guardada. No registra una entrega ni modifica stock.':'Cantidad habitual quitada.');
  }catch{setReady(false);setError('No pudimos confirmar la cantidad. Actualizá antes de reintentar.');}
  finally{setBusy(false);}
 }
 return <section className="customer-habits"><div className="section-heading"><div><h3>Visitas y pedido habitual</h3>{createdAt&&<p>Cargado en HidroTrack el {new Date(createdAt).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</p>}</div><button type="button" disabled={busy||disabled} onClick={()=>{setMessage('');setRetry(v=>v+1);}}>Actualizar hábitos</button></div>
  {error&&<p className="notice" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {!ready?<p>Consultando los hábitos del cliente…</p>:<><p>¿Qué días lo visitás? Tocá cada día para agregarlo o quitarlo; se guarda al momento.</p><div className="customer-weekdays">{weekdays.map((name,index)=><button key={name} type="button" aria-pressed={days.includes(index+1)} className={days.includes(index+1)?'selected':''} disabled={locked} onClick={()=>void toggleDay(index+1)}>{name}</button>)}</div>{!days.length&&<p>Sin día habitual definido.</p>}
   <CustomerVisitWindow onSaved={onChanged} client={client} tenantId={tenantId} customerId={customerId} disabled={disabled||busy} onLock={setWindowBusy}/><h4>Lo que suele pedir</h4>{preferences.length?preferences.map(p=><p className="customer-usual-row" key={p.product_id}><strong>{products.find(item=>item.id===p.product_id)?.name||'Producto anterior'}</strong><span>{p.quantity} unidades por visita</span></p>):!comboPreferences.length?<p>Todavía no hay cantidades habituales registradas.</p>:null}{comboPreferences.map(p=>{const c=combos.find(c=>c.id===p.combo_id);return <div className="customer-usual-row" key={`combo:${p.combo_id}`}><div><strong>{c?.name||'Promo anterior'}</strong>{c&&<p>{c.items.map(i=>`${i.quantity} x ${products.find(v=>v.id===i.product_id)?.name||'Artículo'}`).join(' + ')} - {currency(Number(c.price)*100)} por promo{!c.active?' - desactivada':''}</p>}</div><span>{p.quantity} promos por visita</span></div>;})}
   <form onSubmit={saveQuantity}><fieldset disabled={locked}><div className="customer-habits-fields"><label>Producto habitual<select required value={product} onChange={e=>{setProduct(e.target.value);const value=e.target.value,saved=value.startsWith('combo:')?comboPreferences.find(p=>p.combo_id===value.slice(6)):preferences.find(p=>p.product_id===value);setQuantity(saved?String(saved.quantity):'');}}><option value="">Elegí un producto</option>{products.filter(p=>p.active&&!isDispenserModel(p)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{combos.length>0&&<optgroup label="Promociones">{combos.filter(c=>c.active||comboPreferences.some(p=>p.combo_id===c.id)).map(c=><option key={c.id} value={`combo:${c.id}`}>{c.name}{!c.active?' - desactivada':''}</option>)}</optgroup>}</select></label><label>{product.startsWith('combo:')?'Promos por visita':'Unidades por visita'}<input type="number" inputMode="numeric" required min="0" max="100000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div><p>Elegí productos sueltos o promos. Una promo de dos bidones cuenta dos bidones al preparar el camión. Si reemplaza un pedido anterior, quitá ese pedido con cero para no sumarlo dos veces. Es una referencia para preparar el reparto. Cero quita esa cantidad habitual; no cambia lo que el cliente tiene para devolver.</p><button className="primary">Guardar cantidad habitual</button></fieldset></form>
  </>}
 </section>;
}
