import {AssistantTripView,type AssistantTrip} from './AssistantTripView';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './TripInvitations.css';

type Invitation={tenant_id:string;trip_id:string;name:string;date:string;status:string;state:'pending'|'accepted'|'rejected'|'revoked';company:string;chief:string;driver?:string};
type RoutePointer={tenant:string;trip:string;stop?:string};
export const assistantRouteKey=(userId:string)=>`hidrotrack:assistant-route:${userId}`;
function restoreRoute(userId?:string):RoutePointer|null{if(!userId)return null;try{const value=JSON.parse(localStorage.getItem(assistantRouteKey(userId))||'null');if(value&&typeof value.tenant==='string'&&typeof value.trip==='string'&&value.tenant.length<=100&&value.trip.length<=100)return {tenant:value.tenant,trip:value.trip,...(typeof value.stop==='string'&&value.stop.length<=100?{stop:value.stop}:{})};}catch{}return null;}
const labels={pending:'Esperando respuesta',accepted:'Aceptado',rejected:'Rechazado',revoked:'Retirado por el jefe'};
const dateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('es-AR');

// Refresh on focus and every 30s while visible. Only account-scoped IDs are persisted.
function useRefreshPulse(){
 const [pulse,setPulse]=useState(0);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState!=='hidden')setPulse(v=>v+1);};const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
 return [pulse,()=>setPulse(v=>v+1)] as const;
}

export function AssistantTripInvitations({client,userId}:{client:SupabaseClient;userId?:string}){
 const [items,setItems]=useState<Invitation[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pulse,refresh]=useRefreshPulse();
 const [selected,setSelected]=useState<RoutePointer|null>(()=>restoreRoute(userId)),[preview,setPreview]=useState<AssistantTrip|null>(null),[previewLoading,setPreviewLoading]=useState(false);
 const [deliveryLocked,setDeliveryLocked]=useState(false);
 const request=useRef<{key:string;id:string}|null>(null);
 useEffect(()=>{if(!userId)return;try{if(selected)localStorage.setItem(assistantRouteKey(userId),JSON.stringify(selected));else localStorage.removeItem(assistantRouteKey(userId));}catch{}},[userId,selected]);
 useEffect(()=>{let active=true;void (async()=>{
  try{const r=await client.rpc('assistant_trip_invitations');if(r.error||!Array.isArray(r.data))throw r.error;if(active){setError('');setItems(r.data??[]);setSelected(previous=>previous&&r.data.some((i:Invitation)=>i.tenant_id===previous.tenant&&i.trip_id===previous.trip&&i.state==='accepted')?previous:null);}}
  catch{if(active){setItems(null);setPreview(null);setError('No pudimos consultar las invitaciones. Actualizá para verificar tu acceso.');}}
 })();return()=>{active=false;};},[client,pulse]);
 const selectedAllowed=Boolean(selected&&items?.some(i=>i.tenant_id===selected.tenant&&i.trip_id===selected.trip&&i.state==='accepted'));
 useEffect(()=>{let active=true;if(!selected||!selectedAllowed){setPreviewLoading(false);return;}
  setPreviewLoading(true);void (async()=>{
   try{const r=await client.rpc('assistant_open_trip',{p_tenant:selected.tenant,p_trip:selected.trip});if(r.error||!r.data?.trip||!Array.isArray(r.data.stops))throw r.error??new Error();if(active){setPreview(r.data);const first=r.data.stops.find((s:{outcome:string})=>['pending','present'].includes(s.outcome))??r.data.stops[0];if(first)setSelected(previous=>previous&&previous.tenant===selected.tenant&&previous.trip===selected.trip&&!previous.stop?{...previous,stop:first.id}:previous);}}
   catch(e){if(active){setPreview(null);if((e as {code?:string})?.code==='42501')setSelected(null);setError('El recorrido ya no está disponible o no pudimos verificarlo. Actualizá tus invitaciones.');}}
   finally{if(active)setPreviewLoading(false);}
  })();return()=>{active=false;};},[client,selected?.tenant,selected?.trip,selectedAllowed,pulse]);
 async function answer(i:Invitation,accept:boolean){
  if(busy||deliveryLocked)return;const key=`${i.tenant_id}:${i.trip_id}:${accept}`;if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  setBusy(true);setError('');setNotice('');
  try{const r=await client.rpc('assistant_answer_trip_invitation',{p_tenant:i.tenant_id,p_trip:i.trip_id,p_accept:accept,p_request:request.current.id});if(r.error)throw r.error;
   request.current=null;setPreview(null);setSelected(null);setNotice(r.data==='accepted'?'Aceptaste el reparto. Ya podés abrir el recorrido.':r.data==='rejected'?'Rechazaste la invitación. El jefe puede ver tu respuesta.':'La invitación ya no está disponible.');refresh();
  }catch{setError('No pudimos confirmar la respuesta. Actualizá las invitaciones antes de reintentar.');refresh();}
  finally{setBusy(false);}
 }
 return <section className="assistant-profile-card trip-invitations"><div className="invitation-heading"><h2>Mis invitaciones y recorridos</h2><button className="hd-btn" disabled={busy||deliveryLocked} onClick={refresh}>Actualizar recorridos</button></div>
  {error&&<p role="alert" className="assistant-real-error">{error}</p>}{notice&&<p role="status" className="assistant-real-notice">{notice}</p>}
  {items===null?<p>Consultando acceso a recorridos…</p>:!items.length?<p>En espera de recorrido. Cuando un jefe te invite, aparecerá acá.</p>:items.map(i=><article className="invitation-card" key={i.trip_id}><span className={`invitation-state ${i.state}`}>{labels[i.state]}</span><h3>{i.name}</h3><p>{i.chief} · {i.company}</p><p>{dateLabel(i.date)}</p>
   {i.state==='pending'&&<><p>¿Aceptás este reparto? Al aceptar podrás consultar sus clientes.</p><div className="invitation-actions"><button className="hd-btn primary" disabled={busy||deliveryLocked} onClick={()=>void answer(i,true)}>Aceptar reparto</button><button className="hd-btn" disabled={busy||deliveryLocked} onClick={()=>void answer(i,false)}>Rechazar</button></div></>}
   {i.state==='accepted'&&<button className="hd-btn primary" disabled={busy||deliveryLocked} onClick={()=>{setError('');setPreview(null);setSelected({tenant:i.tenant_id,trip:i.trip_id});}}>Abrir reparto</button>}
  </article>)}
  {selectedAllowed&&previewLoading&&<p role="status">Verificando el recorrido aceptado…</p>}
  {selectedAllowed&&preview&&<AssistantTripView client={client} tenantId={selected?.tenant} tripId={selected?.trip} locked={deliveryLocked} onLock={setDeliveryLocked} onChanged={refresh} data={preview} selectedId={selected?.stop} onSelect={id=>setSelected(previous=>previous?{...previous,stop:id}:null)} onClose={()=>{setSelected(null);setPreview(null);}}/>}
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
