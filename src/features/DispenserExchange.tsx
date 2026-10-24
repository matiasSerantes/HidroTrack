import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { currency } from '../domain/demo';
import { isDispenserModel, stockToday } from './OwnerStockIncident';
import './DispenserExchange.css';
type Product={id:string;name:string;active:boolean;family?:string};
type Assignment={id:string;product_id:string;mode:string;monthly:number;occurred_on:string;last_exchange_on?:string|null;last_operation?:string};
type Command={name:string;args:Record<string,unknown>;message:string};
export function DispenserExchange({tenantId,assignment,products,balances,truck,trips,locked,onSubmit}:{tenantId:string;assignment:Assignment;products:Product[];balances:{product_id:string;depot_ready:number}[];truck:{product_id:string;trip_id:string;ready:number}[];trips:{id:string;name:string;status:string}[];locked:boolean;onSubmit:(command:Command)=>void}){
 const [show,setShow]=useState(false),[selection,setSelection]=useState(''),[condition,setCondition]=useState('good'),[involved,setInvolved]=useState('customer'),[error,setError]=useState('');
 const options=products.filter(p=>p.active&&isDispenserModel(p)).flatMap(p=>[
  ...(Number(balances.find(b=>b.product_id===p.id)?.depot_ready??0)>0?[{value:`${p.id}:depot`,label:`${p.name} · Depósito`}]:[]),
  ...truck.filter(b=>b.product_id===p.id&&Number(b.ready)>0&&trips.some(t=>t.id===b.trip_id&&t.status==='active')).map(b=>({value:`${p.id}:${b.trip_id}`,label:`${p.name} · ${trips.find(t=>t.id===b.trip_id)?.name}`})),
 ]);
 const onTruck=selection!==''&&!selection.endsWith(':depot');
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked)return;if(!options.some(o=>o.value===selection)){setError('Elegí un reemplazo disponible.');return;}
  const f=new FormData(e.currentTarget),[product,origin]=selection.split(':');setError('');
  onSubmit({name:'inventory_exchange_dispenser',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_replacement_id:crypto.randomUUID(),p_assignment:assignment.id,p_product:product,p_date:f.get('date'),p_state:condition,p_involved:condition==='broken'?involved:null,p_note:String(f.get('note')||''),p_trip:origin==='depot'?null:origin},message:'Cambio de dispenser confirmado. Se conserva el contrato y la fecha de alquiler.'});
 }
 return <div className="dispenser-exchange"><button type="button" className="primary" disabled={locked} aria-expanded={show} onClick={()=>setShow(v=>!v)}>Cambiar dispenser</button>{assignment.last_exchange_on&&<p>Último cambio: {assignment.last_exchange_on}</p>}
  {show&&<form onSubmit={submit}><fieldset disabled={locked}><h4>Retirar y reemplazar en un solo paso</h4><p>Se conserva {assignment.mode==='rental'?`el alquiler de ${currency(Number(assignment.monthly)*100)}/mes desde ${assignment.occurred_on}`:'el préstamo gratuito'}. La unidad retirada en buen estado vuelve a la ubicación de origen del reemplazo.</p>
   <label>Dispenser de reemplazo<select required value={selection} onChange={e=>{setSelection(e.target.value);setInvolved('customer');}}><option value="">Elegí modelo y ubicación</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
   {!options.length&&<p>No hay reemplazos disponibles. Actualizá la disponibilidad o registrá la carga correspondiente.</p>}
   <label>Fecha del cambio<input name="date" type="date" required min={assignment.last_exchange_on||assignment.occurred_on} max={stockToday()} defaultValue={stockToday()}/></label>
   <label>Estado del dispenser retirado<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="good">Buen estado · vuelve disponible</option><option value="broken">Roto · baja definitiva del inventario activo</option></select></label>
   {condition==='broken'&&<><p className="exchange-warning">Se registra la baja de una unidad. Para un equipo reparable, esperá el circuito de reparación; esta opción es definitiva.</p><label>Con quién se rompió<select value={involved} onChange={e=>setInvolved(e.target.value)}><option value="customer">Con el cliente</option><option value="owner">Conmigo, jefe de reparto</option>{onTruck&&<option value="driver">Con el asistente de este camión</option>}</select></label></>}
   <label>Nota del cambio<textarea name="note" rows={2} maxLength={400}/></label>{error&&<p role="alert">{error}</p>}
   <button className="primary" disabled={!selection}>Confirmar retiro y reemplazo</button>
  </fieldset></form>}
 </div>;
}
export function DispenserExchangeHistory({client,tenantId,customerId,products,version}:{client:SupabaseClient;tenantId:string;customerId:string;products:Product[];version:string}){
 const [events,setEvents]=useState<{id:string;old_product:string;new_product:string;occurred_on:string;returned_state:string;involved_kind:string|null;note:string}[]|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setFailed(false);void (async()=>{try{const r=await client.from('dispenser_exchanges').select('id,old_product,new_product,occurred_on,returned_state,involved_kind,note').eq('tenant_id',tenantId).eq('customer_id',customerId).order('created_at',{ascending:false}).limit(20);if(r.error)throw r.error;if(active)setEvents(r.data??[]);}catch{if(active){setEvents(null);setFailed(true);}}})();return()=>{active=false;};},[client,tenantId,customerId,version]);
 return <section className="dispenser-exchange-history"><h3>Últimos cambios de dispenser</h3>{failed?<p>No pudimos consultar el historial de cambios. Puede requerir actualizar la base.</p>:events===null?<p>Consultando cambios…</p>:!events.length?<p>No hay cambios de dispenser registrados.</p>:events.map(e=><article key={e.id}><strong>{e.occurred_on} · {products.find(p=>p.id===e.old_product)?.name||'Modelo anterior'} → {products.find(p=>p.id===e.new_product)?.name||'Reemplazo'}</strong><p>{e.returned_state==='broken'?'Retirado roto · baja definitiva':'Retirado en buen estado'}{e.involved_kind?` · Responsable registrado: ${({owner:'jefe',driver:'asistente',customer:'cliente'} as Record<string,string>)[e.involved_kind]}`:''}</p>{e.note&&<p>{e.note}</p>}</article>)}</section>;
}
