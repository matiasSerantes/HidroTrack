import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './OwnerAssistants.css';

type Directory = {license:{plan:string;limit:number|null};members:{user_id:string;name:string;active:boolean}[]};
export function OwnerAssistants({client,tenantId,onLock}:{client:SupabaseClient;tenantId:string;onLock:(locked:boolean)=>void}) {
 const [directory,setDirectory]=useState<Directory|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[shareId,setShareId]=useState(''),[retry,setRetry]=useState(0);
 const request=useRef<{key:string;id:string}|null>(null);
 useEffect(()=>{onLock(busy);return()=>onLock(false);},[busy,onLock]);
 useEffect(()=>{let active=true;setLoading(true);setDirectory(null);void (async()=>{
  try{const r=await client.rpc('owner_assistant_directory',{p_tenant:tenantId});if(r.error)throw r.error;if(active)setDirectory(r.data);}
  catch{if(active)setMessage('No se pudo cargar la lista. Si el servidor aún no tiene la actualización de vínculos, esta sección estará pendiente de activar.');}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[client,tenantId,retry]);
 async function change(id:string,active:boolean){
  if(busy||loading||!directory)return;
  if(!active&&!window.confirm('¿Quitar a este asistente de tu lista? Conserva su cuenta y su historial. Si tiene repartos sin cerrar, primero deberás resolverlos.'))return;
  const normalized=id.trim().toUpperCase();
  if(!/^HT-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(normalized)){setMessage('Pegá el ID completo que te comparte el asistente, empezando por HT-.');return;}
  const key=`${tenantId}:${normalized}:${active}`;
  if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  setBusy(true);setMessage('');
  try{
   const r=await client.rpc('owner_set_assistant_link',{p_tenant:tenantId,p_share_id:normalized,p_active:active,p_request:request.current.id});
   if(r.error){
    const safe=['Se alcanzo el limite de asistentes','Cerra los repartos pendientes antes de quitar al asistente','El ID no corresponde a una cuenta verificada disponible','Selecciona una cuenta de asistente'];
    throw new Error(safe.includes(r.error.message)?r.error.message:'No se pudo confirmar el cambio. Actualizá la lista antes de reintentar y revisá tu licencia y cupo.');
   }
   if(r.data!==normalized.slice(3).toLowerCase())throw new Error('No se recibió una confirmación válida. Actualizá la lista.');
   request.current=null;setShareId('');setMessage(active?'Asistente vinculado. Su cuenta sigue siendo independiente; todavía no tiene acceso a tus clientes por este vínculo.':'Asistente quitado de tu lista. Cuenta e historial conservados.');setRetry(v=>v+1);
  }catch(e){setMessage(e instanceof Error?e.message:'No se pudo confirmar el cambio. Actualizá antes de reintentar.');}
  finally{setBusy(false);}
 }
 function add(e:FormEvent){e.preventDefault();void change(shareId,true);}
 return <section className="panel"><div className="section-heading"><div><h2>Mis asistentes</h2><p className="muted">Agregalos por su ID. Podés volver a elegirlos cuando prepares un reparto.</p></div><button disabled={busy||loading} onClick={()=>{setMessage('');setRetry(v=>v+1);}}>Actualizar lista</button></div>
  {loading?<p role="status">Cargando asistentes…</p>:directory&&<>
   <p><strong>{directory.members.filter(m=>m.active).length} asistentes vinculados</strong> · Cupo: {directory.license.limit===null?'Ilimitado':directory.license.limit} · {({basic:'Básico',intermediate:'Intermedio',unlimited:'Superior',custom:'Licencia actual'} as Record<string,string>)[directory.license.plan]}</p>
   <form className="customer-form" onSubmit={add}><label>ID del asistente<input value={shareId} onChange={e=>setShareId(e.target.value)} placeholder="HT-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" maxLength={39} required disabled={busy}/></label><button className="primary" disabled={busy}>Agregar asistente o empleado</button></form>
   <p className="muted">El asistente crea su propia cuenta y te comparte su ID. No necesitás su contraseña. Puede trabajar con otros jefes. Las invitaciones de recorrido se habilitan en la siguiente etapa.</p>
   {directory.members.map(m=><article className="hd-list-row assistant-team-row" key={m.user_id}><div><strong>{m.name}</strong><small>{m.active?'Vinculado':'Quitado de la lista'} · HT-{m.user_id.toUpperCase()}</small></div><button className={m.active?'secondary':'primary'} disabled={busy} onClick={()=>void change(`HT-${m.user_id}`,!m.active)}>{m.active?'Quitar de mi lista':'Volver a agregar'}</button></article>)}
   {!directory.members.length&&<p>Todavía no agregaste asistentes.</p>}
  </>}{message&&<p className="notice" role="status">{message}</p>}
 </section>;
}
