import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMoney } from '../domain/demo';
import { stockToday } from './OwnerStockIncident';
import './DemoPromotions.css';

type Product={id:string;name:string;family:string;returnable:boolean;active:boolean};
type Promotion={id:string;author_id:string;name:string;address:string;phone:string;terms:string;status:'trial'|'recovery'|'converted'|'closed';started_on:string;follow_up:string;delivered:{product_id:string;quantity:number}[]};
type Movement={product_id:string;promotion_held:number;promotion_damaged:number};
type Snapshot={products:Product[];promotions:Promotion[];balances:{product_id:string;depot_ready:number}[];operations:{promotion_id:string|null;inventory_movements:Movement[]}[];members:{user_id:string;role:string;promotion_allowed:boolean}[];profiles:{user_id:string;full_name:string}[];events:{id:string;promotion_id:string;kind:string;occurred_on:string;actor_id?:string;payload?:{product_id:string;quantity?:number;good?:number;damaged?:number}[]}[];notices:{id:string;promotion_id:string;read_at:string|null}[]};
type Command={name:string;args:Record<string,unknown>;message:string;converted?:boolean};
const labels={trial:'En prueba',recovery:'Pendiente de recuperación',converted:'Convertida en cliente',closed:'Cerrada · bienes recuperados'};
const eventLabels:Record<string,string>={offer:'Entrega de prueba',convert:'Aceptó el servicio',reject:'No continúa: recuperar bienes',recover:'Devolución registrada'};
export function OwnerPromotions({client,tenantId,userId,onLock,onConverted}:{client:SupabaseClient;tenantId:string;userId:string;onLock?:(locked:boolean)=>void;onConverted?:()=>void}){
  const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false),[pending,setPending]=useState<Command|null>(null),[creating,setCreating]=useState(false),[formKey,setFormKey]=useState(0);
  const locked=busy||pending!==null;
  useEffect(()=>{onLock?.(locked);return()=>onLock?.(false);},[locked,onLock]);
  async function operations(){
    const rows:Snapshot['operations']=[];
    for(let offset=0;;offset+=500){
      const result=await client.from('inventory_operations').select('promotion_id,inventory_movements(product_id,promotion_held,promotion_damaged)').eq('tenant_id',tenantId).not('promotion_id','is',null).order('id').range(offset,offset+499);
      if(result.error)throw new Error('No pudimos consultar las tenencias de promociones.');
      const batch=(result.data||[]) as unknown as Snapshot['operations'];rows.push(...batch);
      if(batch.length<500)return {data:rows,error:null};
    }
  }
  async function load(){
    const results=await Promise.all([
      client.from('products').select('id,name,family,returnable,active').eq('tenant_id',tenantId).order('name'),
      client.from('promotions').select('*').eq('tenant_id',tenantId).order('created_at',{ascending:false}),
      client.from('inventory_owned_stock').select('product_id,depot_ready').eq('tenant_id',tenantId),
      operations(),
      client.from('tenant_members').select('user_id,role,promotion_allowed').eq('tenant_id',tenantId).eq('active',true),
      client.from('user_profiles').select('user_id,full_name'),
      client.from('promotion_events').select('id,promotion_id,kind,occurred_on,actor_id,payload').eq('tenant_id',tenantId).order('created_at',{ascending:false}),
      client.from('promotion_notifications').select('id,promotion_id,read_at').eq('tenant_id',tenantId).eq('recipient_id',userId).order('created_at',{ascending:false}),
    ]);
    const failed=results.find(r=>r.error);if(failed)throw new Error('No pudimos cargar promociones. Revisá la conexión, la licencia y tu acceso.');
    return {products:results[0].data||[],promotions:results[1].data||[],balances:results[2].data||[],operations:results[3].data||[],members:results[4].data||[],profiles:results[5].data||[],events:results[6].data||[],notices:results[7].data||[]} as unknown as Snapshot;
  }
  useEffect(()=>{let active=true;void load().then(s=>{if(active)setData(s);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[client,tenantId,userId]);
  async function refresh(){if(locked)return;setBusy(true);setError('');try{setData(await load());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function execute(command:Command){
    if(busy)return;setPending(command);setBusy(true);setError('');setNotice('');
    try{
      const result=await client.rpc(command.name,command.args);
      if(result.error){
        // A database rejection rolled back. A lost response must retry the same ID.
        if(['P0001','42501','23514','23505','23503','22P02'].includes(result.error.code))setPending(null);
        throw new Error(result.error.message||'No se pudo confirmar la operación.');
      }
      setPending(null);setCreating(false);setFormKey(k=>k+1);setNotice(command.message);
      try{setData(await load());}catch{setError('La operación quedó guardada. No la repitas: usá Actualizar para consultar el resultado.');}
      if(command.converted)onConverted?.();
    }catch(e){setError(e instanceof Error?e.message:'No se recibió confirmación. Reintentá la misma operación.');}
    finally{setBusy(false);}
  }
  function command(name:string,args:Record<string,unknown>,message:string,converted=false){if(locked)return;void execute({name,args:{p_tenant:tenantId,p_id:crypto.randomUUID(),...args},message,converted});}
  function offer(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!data||locked)return;const f=new FormData(e.currentTarget);const items=data.products.filter(p=>p.active&&(p.returnable||p.family==='dispenser')).map(p=>({product_id:p.id,quantity:Number(f.get(`item:${p.id}`))})).filter(p=>p.quantity>0);if(!items.length){setError('Indicá al menos un artículo para entregar.');return;}command('promotion_offer',{p_trip:null,p_name:String(f.get('name')).trim(),p_address:String(f.get('address')).trim(),p_phone:String(f.get('phone')).trim(),p_terms:String(f.get('terms')).trim(),p_date:String(f.get('date')),p_follow_up:String(f.get('follow_up')),p_items:items},'Promoción registrada; las unidades salieron del depósito.');}
  const held=(promo:string)=>data?.operations.filter(o=>o.promotion_id===promo).flatMap(o=>o.inventory_movements).reduce<Record<string,number>>((a,m)=>({...a,[m.product_id]:(a[m.product_id]||0)+Number(m.promotion_held)}),{})||{};
  const name=(id:string)=>data?.products.find(p=>p.id===id)?.name||'Artículo histórico';
  const author=(id:string)=>data?.profiles.find(p=>p.user_id===id)?.full_name||(id===userId?'Jefe de reparto':'Asistente');
  return <div className="hd-promotions connected-promotions">
    <div className="section-heading"><div><h2>Promociones en prueba</h2><p>Cuenta real · los cambios se guardan en tu empresa.</p></div><button className="primary" disabled={locked} onClick={()=>void refresh()}>Actualizar promociones</button></div>
    {notice&&<p className="notice" role="status">{notice}</p>}{error&&<p className="stock-error" role="alert">{error}</p>}
    {pending&&!busy&&<div className="hd-callout"><p>La respuesta no quedó confirmada. Reintentá con el mismo identificador para evitar duplicar la operación. Mantené esta pantalla abierta.</p><button className="hd-btn primary" onClick={()=>void execute(pending)}>Reintentar operación</button></div>}
    {!data?<p role="status">Cargando promociones…</p>:<>
    <section className="hd-card"><h2>Permisos de asistentes</h2><p>Solo vos podés habilitar o revocar. Cada promoción que ofrezcan te deja un aviso.</p>{data.members.filter(m=>m.role==='driver').map(m=><label className="promo-permission" key={m.user_id}><span><input type="checkbox" disabled={locked} checked={m.promotion_allowed} onChange={e=>command('promotion_set_permission',{p_user:m.user_id,p_allowed:e.target.checked},'Permiso del asistente actualizado.')}/> Permitir ofrecer promociones a {author(m.user_id)}</span></label>)}{!data.members.some(m=>m.role==='driver')&&<p>No hay asistentes activos vinculados a tu empresa.</p>}</section>
    <section className="hd-card"><h2>Avisos de promociones</h2>{data.notices.filter(n=>!n.read_at).map(n=>{const p=data.promotions.find(p=>p.id===n.promotion_id);return <article className="promo-terms" key={n.id}><strong>{p?`${author(p.author_id)} ofreció una promoción a ${p.name}`:'Promoción registrada'}</strong>{p&&<><p>{p.address} · Próxima visita: {p.follow_up}</p><p>{p.terms}</p><ul>{p.delivered.map(i=><li key={i.product_id}>{name(i.product_id)}: {i.quantity}</li>)}</ul></>}<button className="hd-btn secondary" disabled={locked} onClick={()=>command('promotion_read_notification',{p_id:n.id},'Aviso marcado como leído.')}>Marcar leído</button></article>;})}{!data.notices.some(n=>!n.read_at)&&<p>No hay avisos pendientes.</p>}</section>
    <section className="hd-card"><div className="hd-section"><h2>Nueva promoción</h2><button className="hd-btn primary" disabled={locked} onClick={()=>setCreating(!creating)}>{creating?'Cancelar':'Ofrecer promoción'}</button></div><p>La persona todavía no cuenta como cliente. Entregás desde el depósito y fijás cuándo volver. Las condiciones y el precio quedan escritos; no generan cobros automáticos.</p>
    {creating&&<form key={formKey} onSubmit={offer}><fieldset disabled={locked}><div className="hd-form-grid"><label className="hd-field">Nombre<input name="name" required maxLength={120}/></label><label className="hd-field">Dirección<input name="address" required maxLength={240}/></label><label className="hd-field">Teléfono<input name="phone" type="tel" maxLength={80}/></label><label className="hd-field">Fecha de entrega<input name="date" type="date" required defaultValue={stockToday()} max={stockToday()}/></label><label className="hd-field">Próxima visita<input name="follow_up" type="date" required defaultValue={stockToday()}/></label></div><label className="hd-field">Condiciones y precio pactados<textarea name="terms" required maxLength={1000}/></label><h3>Artículos que entregás</h3><div className="hd-form-grid">{data.products.filter(p=>p.active&&(p.returnable||p.family==='dispenser')).map(p=>{const q=Number(data.balances.find(b=>b.product_id===p.id)?.depot_ready||0);return <label className="hd-field" key={p.id}>{p.name} · {q} disponibles<input name={`item:${p.id}`} aria-label={`Entregar ${p.name}`} type="number" min="0" max={q} step="1" defaultValue="0"/></label>;})}</div><button className="hd-btn primary">Registrar promoción</button></fieldset></form>}</section>
    {!data.promotions.length&&<p>Todavía no hay personas en promoción.</p>}
    {data.promotions.map(p=>{const quantities=held(p.id);return <section key={p.id} className={`hd-card promo-${p.status}`}><div className="hd-section"><div><h2>{p.name}</h2><p>{p.address} · {p.phone}</p></div><span className="hd-tag">{labels[p.status]}</span></div><p>Ofrecida por {author(p.author_id)} · Entrega: {p.started_on} · Próxima visita: {p.follow_up}</p><p className="promo-terms">{p.terms}</p><h3>{p.status==='converted'?'Bienes transferidos a su planilla':'Bienes pendientes de recuperación'}</h3><ul>{Object.entries(quantities).filter(([,q])=>q>0).map(([id,q])=><li key={id}>{name(id)}: {q}</li>)}</ul>{p.status==='converted'&&<p>Ya figura en Clientes. Conserva sus envases y equipos sin duplicar la entrega.</p>}
    {p.status==='trial'&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const monthly=Object.fromEntries(Object.keys(quantities).filter(id=>data.products.find(v=>v.id===id)?.family==='dispenser').map(id=>[id,parseMoney(String(f.get(`monthly:${id}`)))/100]));command('promotion_resolve',{p_promotion:p.id,p_action:'convert',p_date:String(f.get('date')),p_customer:crypto.randomUUID(),p_monthly:monthly},'Promoción convertida en cliente. No se volvió a descontar stock.',true);}catch{setError('Revisá las cuotas indicadas.');}}}><fieldset disabled={locked}><label className="hd-field">Fecha de decisión<input name="date" type="date" min={p.started_on} max={stockToday()} defaultValue={stockToday()} required/></label>{Object.keys(quantities).filter(id=>data.products.find(v=>v.id===id)?.family==='dispenser').map(id=><label className="hd-field" key={id}>Cuota mensual de {name(id)} ($; 0 = préstamo gratuito)<input name={`monthly:${id}`} required inputMode="decimal" defaultValue="0"/></label>)}<p>Al continuar, el alquiler comienza en la fecha de decisión. Esta acción no cobra la promoción ni la primera cuota.</p><div className="promo-actions"><button className="hd-btn primary">Acepta · pasar a cliente</button><button className="hd-btn secondary" type="button" onClick={e=>{const form=e.currentTarget.closest('form')!;if(!form.reportValidity())return;command('promotion_resolve',{p_promotion:p.id,p_action:'reject',p_date:String(new FormData(form).get('date'))},'Promoción pendiente de recuperar bienes.');}}>No continúa · recuperar bienes</button></div></fieldset></form>}
    {p.status==='recovery'&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const items=Object.keys(quantities).map(id=>({product_id:id,good:Number(f.get(`good:${id}`)),damaged:Number(f.get(`damaged:${id}`))})).filter(i=>i.good+i.damaged>0);if(!items.length){setError('Indicá qué devuelve.');return;}command('promotion_recover',{p_promotion:p.id,p_date:String(f.get('date')),p_items:items},'Devolución registrada. Solo se cierra cuando no quedan bienes pendientes.');}}><fieldset disabled={locked}><p className="promo-warning">Sin nuevas entregas. Los dañados no vuelven al stock disponible.</p><label className="hd-field">Fecha de devolución<input name="date" type="date" min={p.started_on} max={stockToday()} defaultValue={stockToday()} required/></label>{Object.entries(quantities).filter(([,q])=>q>0).map(([id,q])=><div key={id}><h3>{name(id)} · pendientes {q}</h3><div className="hd-form-grid"><label className="hd-field">Devuelve en buen estado<input name={`good:${id}`} type="number" min="0" max={q} defaultValue="0"/></label><label className="hd-field">Devuelve dañado<input name={`damaged:${id}`} type="number" min="0" max={q} defaultValue="0"/></label></div></div>)}<button className="hd-btn primary">Registrar devolución</button></fieldset></form>}
    <details><summary>Historial de la promoción</summary><ul>{data.events.filter(e=>e.promotion_id===p.id).map(e=><li key={e.id}>{e.occurred_on} · {eventLabels[e.kind]||e.kind}{e.actor_id&&` · ${author(e.actor_id)}`}{Array.isArray(e.payload)&&<ul>{e.payload.map(i=><li key={i.product_id}>{name(i.product_id)}: {e.kind==='recover'?`${i.good||0} en buen estado, ${i.damaged||0} dañados`:`${i.quantity||0} entregados`}</li>)}</ul>}</li>)}</ul></details></section>;})}</>}
  </div>;
}
