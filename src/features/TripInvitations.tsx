import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './TripInvitations.css';

type Invitation={tenant_id:string;trip_id:string;name:string;date:string;status:string;state:'pending'|'accepted'|'rejected'|'revoked';company:string;chief:string;driver?:string};
type TripPreview={trip:{name:string;date:string;status:string};stops:{id:string;name:string;address:string;phone:string;position:number;outcome:string;pending_recovery:boolean}[]};
const labels={pending:'Esperando respuesta',accepted:'Aceptado',rejected:'Rechazado',revoked:'Retirado por el jefe'};
const dateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('es-AR');

// Refresh on focus and every 30s while visible. No route data in browser storage.
function useRefreshPulse(){
 const [pulse,setPulse]=useState(0);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState!=='hidden')setPulse(v=>v+1);};const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
 return [pulse,()=>setPulse(v=>v+1)] as const;
}

export function AssistantTripInvitations({client}:{client:SupabaseClient}){
 const [items,setItems]=useState<Invitation[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pulse,refresh]=useRefreshPulse();
 const [selected,setSelected]=useState<{tenant:string;trip:string}|null>(null),[preview,setPreview]=useState<TripPreview|null>(null),[previewLoading,setPreviewLoading]=useState(false);
 const request=useRef<{key:string;id:string}|null>(null);
 useEffect(()=>{let active=true;void (async()=>{
  try{const r=await client.rpc('assistant_trip_invitations');if(r.error||!Array.isArray(r.data))throw r.error;if(active){setError('');setItems(r.data??[]);}}
  catch{if(active){setItems(null);setPreview(null);setSelected(null);setError('No pudimos consultar las invitaciones. Actualizá para verificar tu acceso.');}}
 })();return()=>{active=false;};},[client,pulse]);
 const selectedAllowed=Boolean(selected&&items?.some(i=>i.tenant_id===selected.tenant&&i.trip_id===selected.trip&&i.state==='accepted'));
 useEffect(()=>{let active=true;setPreview(null);if(!selected||!selectedAllowed){setPreviewLoading(false);return;}
  setPreviewLoading(true);void (async()=>{
   try{const r=await client.rpc('assistant_open_trip',{p_tenant:selected.tenant,p_trip:selected.trip});if(r.error)throw r.error;if(active)setPreview(r.data);}
   catch{if(active){setSelected(null);setError('El recorrido ya no está disponible o no pudimos verificarlo. Actualizá tus invitaciones.');}}
   finally{if(active)setPreviewLoading(false);}
  })();return()=>{active=false;};},[client,selected,selectedAllowed,pulse]);
 async function answer(i:Invitation,accept:boolean){
  if(busy)return;const key=`${i.tenant_id}:${i.trip_id}:${accept}`;if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  setBusy(true);setError('');setNotice('');
  try{const r=await client.rpc('assistant_answer_trip_invitation',{p_tenant:i.tenant_id,p_trip:i.trip_id,p_accept:accept,p_request:request.current.id});if(r.error)throw r.error;
   request.current=null;setPreview(null);setSelected(null);setNotice(r.data==='accepted'?'Aceptaste el reparto. Ya podés ver su resumen.':r.data==='rejected'?'Rechazaste la invitación. El jefe puede ver tu respuesta.':'La invitación ya no está disponible.');refresh();
  }catch{setError('No pudimos confirmar la respuesta. Actualizá las invitaciones antes de reintentar.');refresh();}
  finally{setBusy(false);}
 }
 return <section className="assistant-profile-card trip-invitations"><div className="invitation-heading"><h2>Mis invitaciones y recorridos</h2><button className="hd-btn" disabled={busy} onClick={refresh}>Actualizar recorridos</button></div>
  {error&&<p role="alert" className="assistant-real-error">{error}</p>}{notice&&<p role="status" className="assistant-real-notice">{notice}</p>}
  {items===null?<p>Consultando acceso a recorridos…</p>:!items.length?<p>En espera de recorrido. Cuando un jefe te invite, aparecerá acá.</p>:items.map(i=><article className="invitation-card" key={i.trip_id}><span className={`invitation-state ${i.state}`}>{labels[i.state]}</span><h3>{i.name}</h3><p>{i.chief} · {i.company}</p><p>{dateLabel(i.date)}</p>
   {i.state==='pending'&&<><p>¿Aceptás este reparto? Al aceptar podrás consultar sus clientes.</p><div className="invitation-actions"><button className="hd-btn primary" disabled={busy} onClick={()=>void answer(i,true)}>Aceptar reparto</button><button className="hd-btn" disabled={busy} onClick={()=>void answer(i,false)}>Rechazar</button></div></>}
   {i.state==='accepted'&&<button className="hd-btn primary" disabled={busy} onClick={()=>{setError('');setPreview(null);setSelected({tenant:i.tenant_id,trip:i.trip_id});}}>Ver recorrido</button>}
  </article>)}
  {selectedAllowed&&previewLoading&&<p role="status">Verificando el recorrido aceptado…</p>}
  {selectedAllowed&&preview&&<section className="invitation-preview"><div className="invitation-heading"><h3>{preview.trip.name}</h3><button className="hd-btn" disabled={busy} onClick={()=>{setSelected(null);setPreview(null);}}>Cerrar recorrido</button></div><p>{preview.stops.length} clientes asignados. La atención, la carga del chofer y los cobros se habilitarán en la próxima etapa.</p>{preview.stops.map((s,index)=><article className="invitation-card" key={s.id}><strong>{index+1}. {s.name}</strong><p>{s.address}</p>{s.phone&&<p>Teléfono: {s.phone}</p>}{s.pending_recovery&&<p className="invitation-state rejected">Pendiente de recuperación · No entregar</p>}</article>)}</section>}
 </section>;
}

export function OwnerTripInvitations({client,tenantId,disabled,onLock,onChanged,refreshKey}:{client:SupabaseClient;tenantId:string;disabled:boolean;onLock:(value:boolean)=>void;onChanged:()=>void;refreshKey:string}){
 const [items,setItems]=useState<Invitation[]|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pulse,refresh]=useRefreshPulse();
 const request=useRef<{trip:string;id:string}|null>(null);
 const changed=useRef(onChanged),signature=useRef<string|null>(null);changed.current=onChanged;
 useEffect(()=>{onLock(busy);return()=>onLock(false);},[busy,onLock]);
 useEffect(()=>{let active=true;void (async()=>{try{const r=await client.rpc('owner_trip_invitations',{p_tenant:tenantId});if(r.error||!Array.isArray(r.data))throw r.error;if(active){const next=JSON.stringify((r.data??[]).map((i:Invitation)=>[i.trip_id,i.state,i.status]));setItems(r.data??[]);if(signature.current!==null&&signature.current!==next)changed.current();signature.current=next;}}catch{if(active){setItems(null);setMessage('No se pudo consultar el estado de las invitaciones. Puede requerir actualizar el servidor.');}}})();return()=>{active=false;};},[client,tenantId,pulse,refreshKey]);
 async function revoke(i:Invitation){
  if(busy||disabled||!window.confirm(`¿Retirar la invitación de ${i.driver} a ${i.name}? Perderá acceso al resumen. La carga, el reparto y su historial se conservan y quedan a cargo del jefe.`))return;
  if(request.current?.trip!==i.trip_id)request.current={trip:i.trip_id,id:crypto.randomUUID()};setBusy(true);setMessage('');
  try{const r=await client.rpc('owner_revoke_trip_invitation',{p_tenant:tenantId,p_trip:i.trip_id,p_request:request.current.id});if(r.error||r.data!=='revoked')throw new Error();request.current=null;setMessage('Invitación retirada. El asistente perdió el acceso a su resumen.');refresh();onChanged();}
  catch{setMessage('No pudimos confirmar el retiro. Actualizá la lista antes de reintentar.');refresh();}
  finally{setBusy(false);}
 }
 return <section className="stock-panel trip-invitations"><div className="invitation-heading"><h3>Invitaciones de mis repartos</h3><button disabled={busy||disabled} onClick={()=>{refresh();onChanged();}}>Actualizar respuestas</button></div><p>Al crear un reparto para un asistente se envía la invitación. Esperá su aceptación antes de cargar el camión.</p>{message&&<p role="status" className="notice">{message}</p>}{items===null?<p>Consultando invitaciones…</p>:!items.length?<p>No hay invitaciones de repartos abiertos.</p>:items.map(i=><article key={i.trip_id} className="invitation-card"><span className={`invitation-state ${i.state}`}>{labels[i.state]}</span><h4>{i.name}</h4><p>{i.driver} · {dateLabel(i.date)}</p>{i.state!=='revoked'&&<button disabled={busy||disabled} onClick={()=>void revoke(i)}>Retirar invitación</button>}</article>)}</section>;
}
