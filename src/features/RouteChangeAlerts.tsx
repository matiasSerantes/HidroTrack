import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PushNotificationConsent} from './PushNotificationConsent';
import {isMobileDevice} from '../lib/pushSession';
type Change={id:string;kind:string;position:number;customer:string|null;created_at:string;read_at:string|null};
type Changes={available:boolean;push_enabled:boolean;unread:number;items:Change[]};
const labels:Record<string,string>={customer_updated:'Datos del cliente modificados',visit_window_updated:'Horario de visita modificado',stop_added:'Parada agregada',stop_removed:'Parada retirada',stop_reordered:'Orden de parada modificado'};
export function RouteChangeAlerts({client,tenantId,tripId,disabled,onChanged}:{client:SupabaseClient;tenantId:string;tripId:string;disabled:boolean;onChanged?:()=>void}){
 const [data,setData]=useState<Changes|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[device,setDevice]=useState(false),[revision,setRevision]=useState(0);
 const flight=useRef(false);
 useEffect(()=>{let live=true,loading=false;async function load(){if(loading||document.hidden||disabled||flight.current)return;loading=true;
  try{const r=await client.rpc('assistant_route_changes',{p_tenant:tenantId,p_trip:tripId});if(r.error||!Array.isArray(r.data?.items))throw new Error();if(live){setData(r.data);setError('');}}
  catch{if(live){setData(null);setError('No pudimos consultar los cambios. Actualizá el recorrido para verificar tu acceso.');}}finally{loading=false;}}
  void load();const timer=setInterval(()=>void load(),30000),focus=()=>void load();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[client,tenantId,tripId,disabled,revision]);
 async function command(name:string,args:Record<string,unknown>){if(disabled||flight.current)return;flight.current=true;setBusy(true);setError('');
  try{const r=await client.rpc(name,args);if(r.error)throw r.error;setRevision(v=>v+1);}catch{setError('No se confirmó el cambio. Actualizá los avisos antes de reintentar.');setData(null);}finally{flight.current=false;setBusy(false);}}
 return <section className="route-change-alerts" aria-label="Cambios del jefe en el reparto"><h4>Cambios del jefe</h4>
 {error&&<p role="alert">{error}</p>}{data?<><p role="status">{data.unread} avisos sin leer.</p>{data.items.map(e=><article key={e.id}><strong>{labels[e.kind]||'Recorrido actualizado'}{!e.read_at?' · Nuevo':''}</strong><p>{e.customer||`Parada ${e.position}`}</p><small>{new Date(e.created_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</small></article>)}{!data.items.length&&<p>Todavía no hay cambios del jefe en este recorrido.</p>}
 {data.items.some(e=>!e.read_at)&&<button className="hd-btn" disabled={disabled||busy} onClick={()=>void command('assistant_read_route_changes',{p_tenant:tenantId,p_trip:tripId,p_ids:data.items.filter(e=>!e.read_at).map(e=>e.id)})}>Marcar estos avisos como leídos</button>}
 {data.unread>0&&<button className="hd-btn primary" disabled={disabled||busy} onClick={onChanged}>Actualizar recorrido</button>}
 </>:!error&&<p role="status">Consultando cambios del reparto…</p>}
 <button className="hd-btn" disabled={disabled||busy} onClick={()=>setRevision(v=>v+1)}>Actualizar avisos</button>
 <PushNotificationConsent client={client} routeChanges onActiveChange={setDevice}/>
 {isMobileDevice()&&data?.available&&<><p>Los cambios del jefe tienen una activación separada. El aviso del celular no muestra nombres ni direcciones.</p><button className="hd-btn primary" disabled={disabled||busy||(!data.push_enabled&&!device)} onClick={()=>void command('assistant_set_route_change_push',{p_enabled:!data.push_enabled})}>{data.push_enabled?'Desactivar avisos de cambios del jefe':'Activar avisos de cambios del jefe'}</button><p>Se aplica a tus recorridos aceptados. Al retirar tu acceso o cerrar el reparto se detienen los nuevos avisos.</p></>}
 </section>;
}
