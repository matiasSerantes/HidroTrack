import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {currency,parseMoney} from '../domain/demo';
import {stockToday} from './OwnerStockIncident';

type Charge={id:string;total:number;paid:number;balance:number;occurred_on:string};
type Detail={id:string;kind:string;description:string};
type Opening={p_tenant:string;p_customer:string;p_id:string;p_amount:number;p_date:string;p_note:string};
export function OwnerCustomerAccount({client,tenantId,customerId,disabled,onLock}:{client:SupabaseClient;tenantId:string;customerId:string;disabled:boolean;onLock:(v:boolean)=>void}){
 const [data,setData]=useState<{charges:Charge[];details:Detail[]}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<Opening|null>(null),[version,setVersion]=useState(0);
 const inFlight=useRef(false);
 useEffect(()=>{onLock(busy||pending!==null);return()=>onLock(false);},[busy,pending,onLock]);
 useEffect(()=>{let active=true;setData(null);void(async()=>{
  async function all(table:string,columns:string){const rows:unknown[]=[];for(let offset=0;;offset+=500){const r=await client.from(table).select(columns).eq('tenant_id',tenantId).eq('customer_id',customerId).order('id').range(offset,offset+499);if(r.error||!Array.isArray(r.data))throw new Error();rows.push(...r.data);if(r.data.length<500)return rows;}}
  try{const [charges,details]=await Promise.all([all('customer_sale_balances','id,total,paid,balance,occurred_on'),all('sales','id,kind,description')]);if(active){setData({charges:charges as Charge[],details:details as Detail[]});setError('');}}catch{if(active)setError('No pudimos consultar la cuenta corriente. Actualizá para ver el saldo.');}
 })();return()=>{active=false;};},[client,tenantId,customerId,version]);
 async function save(command:Opening){if(inFlight.current||disabled)return;inFlight.current=true;setBusy(true);setPending(command);setError('');setNotice('');
  try{const r=await client.rpc('commerce_open_customer_balance',command);if(r.error){if(/^[0-9A-Z]{5}$/.test(r.error.code||''))setPending(null);throw r.error;}if(r.data!==command.p_id)throw new Error('No recibimos confirmación. Reintentá la misma carga.');setPending(null);setShow(false);setNotice('Deuda inicial registrada en la cuenta del cliente.');setVersion(v=>v+1);
  }catch(e){setError((e as Error).message||'No recibimos confirmación. Reintentá la misma carga.');}finally{inFlight.current=false;setBusy(false);}}
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{const amount=parseMoney(String(f.get('amount')||'')),date=String(f.get('date')||''),note=String(f.get('note')||'').trim();if(amount<=0||amount>99999999999999||!date||date>stockToday()||!note||note.length>400)throw new Error('Revisá el monto, la fecha y la referencia de la deuda.');void save({p_tenant:tenantId,p_customer:customerId,p_id:crypto.randomUUID(),p_amount:amount/100,p_date:date,p_note:note});}catch(e){setError((e as Error).message);}}
 const locked=disabled||busy||pending!==null;
 const total=data?.charges.reduce((n,c)=>n+Math.round(Number(c.balance)*100),0)||0;
 return <section className="stock-panel" aria-label="Cuenta corriente del cliente"><h3>Cuenta corriente</h3>{notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="stock-error">{error}</p>}
 {data?<><div className="notice" style={total>0?{background:'#fff3e3',color:'#854610',border:'1px solid #efc48b'}:undefined}><p>{total>0?'Debe actualmente':'Sin deuda pendiente'}</p><strong style={{fontSize:'1.8rem'}}>{currency(total)}</strong></div>
 {!data.charges.length&&!data.details.length?<><p>Podés cargar la deuda que ya tenía antes de usar HidroTrack. No registra una entrega ni modifica el stock.</p><button className="primary" disabled={locked} onClick={()=>setShow(v=>!v)} aria-expanded={show}>Cargar deuda anterior</button>{show&&<form onSubmit={submit}><fieldset disabled={locked}><label>Monto de deuda anterior ($)<input name="amount" inputMode="decimal" placeholder="Ej.: 12000,50" required/></label><label>Fecha de la deuda<input name="date" type="date" defaultValue={stockToday()} max={stockToday()} required/></label><label>Referencia de la deuda<input name="note" maxLength={400} placeholder="Ej.: saldo de la libreta anterior" required/></label><button className="primary">Guardar deuda inicial</button></fieldset></form>}</>:<><p>La cuenta ya tiene movimientos. La apertura inicial no se puede repetir.</p><h4>Cargos y cobros acumulados</h4>{[...data.charges].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)).map(c=>{const detail=data.details.find(d=>d.id===c.id);return <article className="customer-held-row" key={c.id}><div><strong>{detail?.kind==='opening'?'Deuda anterior':detail?.kind==='rental'?'Cuota de alquiler':'Entrega'}</strong><p>{c.occurred_on} · {detail?.description||'Cargo del cliente'}</p><p>Importe: {currency(Math.round(Number(c.total)*100))} · Pagado: {currency(Math.round(Number(c.paid)*100))} · Pendiente: {currency(Math.round(Number(c.balance)*100))}</p></div></article>;})}</>}
 </>:<p role="status">Saldo sin verificar.</p>}
 {pending&&<button className="primary" disabled={disabled||busy} onClick={()=>void save(pending)}>Reintentar misma deuda</button>}
 <button disabled={locked} onClick={()=>setVersion(v=>v+1)}>Actualizar cuenta corriente</button></section>;
}
