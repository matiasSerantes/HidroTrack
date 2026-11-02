import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {hasRoutePoint} from '../domain/routeNearby';
export function ShareTripLocation({client,tenantId,tripId,customerId}:{client:SupabaseClient;tenantId:string;tripId:string;customerId?:string}){
 const [sharing,setSharing]=useState(false),[starting,setStarting]=useState(false),[message,setMessage]=useState('');
 const session=useRef<string|null>(null),watch=useRef<number|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),mounted=useRef(true),sending=useRef(false),lastAttempt=useRef(0),selected=useRef(customerId);
 selected.current=customerId;
 function clear(){if(watch.current!==null){navigator.geolocation?.clearWatch(watch.current);watch.current=null;}if(timer.current){clearInterval(timer.current);timer.current=null;}}
 function stop(id=session.current,notice='Dejaste de compartir tu ubicación.'){
  if(!id||session.current!==id)return;session.current=null;clear();if(mounted.current){setSharing(false);setStarting(false);setMessage(notice);}
  void client.rpc('assistant_stop_trip_sharing',{p_tenant:tenantId,p_trip:tripId,p_session:id}).then(r=>{if(r.error&&mounted.current&&!session.current)setMessage('Se detuvo el GPS en este teléfono. No pudimos confirmar el retiro del punto; dejará de mostrarse al vencer su vigencia.');},()=>{if(mounted.current&&!session.current)setMessage('Se detuvo el GPS. El último punto dejará de mostrarse al vencer su vigencia.');});
 }
 useEffect(()=>{mounted.current=true;const hide=()=>{if(document.hidden)stop(session.current,'Se pausó la ubicación al ocultar el mapa. Activala de nuevo si querés compartir.');};document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',hide);
  return()=>{mounted.current=false;document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',hide);stop();clear();};
 },[client,tenantId,tripId]);
 async function start(){
  if(session.current||document.hidden)return;
  if(!navigator.geolocation){setMessage('Este navegador no permite compartir GPS.');return;}
  const id=crypto.randomUUID();session.current=id;lastAttempt.current=0;setStarting(true);setMessage('Habilitando ubicación para este reparto…');
  try{
   const r=await client.rpc('assistant_start_trip_sharing',{p_tenant:tenantId,p_trip:tripId,p_session:id});
   if(r.error||r.data?.sharing!==true)throw new Error();
   if(!mounted.current||session.current!==id||document.hidden){if(session.current===id)stop(id);else void client.rpc('assistant_stop_trip_sharing',{p_tenant:tenantId,p_trip:tripId,p_session:id}).then(()=>{},()=>{});return;}
   setSharing(true);setStarting(false);setMessage('Esperando una ubicación precisa. El jefe todavía puede no tener un punto reciente.');
   const publish=async(p:GeolocationPosition)=>{
    if(session.current!==id||document.hidden||sending.current||Date.now()-lastAttempt.current<15000)return;
    const sample={latitude:p.coords.latitude,longitude:p.coords.longitude};
    if(!hasRoutePoint(sample)||!Number.isFinite(p.coords.accuracy)||p.coords.accuracy<0||p.coords.accuracy>100||!Number.isFinite(p.timestamp)||Date.now()-p.timestamp>30000||p.timestamp>Date.now()+5000){if(mounted.current)setMessage('GPS sin precisión suficiente. Esperando otra lectura; podés seguir usando el reparto.');return;}
    sending.current=true;lastAttempt.current=Date.now();
    try{const sent=await client.rpc('assistant_publish_trip_position',{p_tenant:tenantId,p_trip:tripId,p_session:id,p_latitude:sample.latitude,p_longitude:sample.longitude,p_accuracy:p.coords.accuracy,p_captured:new Date(p.timestamp).toISOString(),p_customer:selected.current||null});
     if(session.current!==id||!mounted.current)return;
     if(sent.error){if(sent.error.code==='42501'){stop(id,'La sesión de ubicación o el acceso al reparto ya no están vigentes. Activala de nuevo si corresponde.');return;}throw new Error();}
     if(sent.data?.updated===true)setMessage('Ubicación compartida con tu jefe. Se actualiza mientras este mapa está visible.');
    }catch{if(mounted.current&&session.current===id)setMessage('No pudimos actualizar la ubicación. Se reintentará con otra lectura; el jefe verá si la señal vence.');}finally{sending.current=false;}
   };
   const fail=(e:GeolocationPositionError)=>{if(session.current!==id)return;if(e.code===1)stop(id,'No se dio permiso de GPS. No estás compartiendo ubicación.');else if(mounted.current)setMessage('Sin señal GPS reciente. Revisá ubicación y permisos; podés detener el envío.');};
   const options={enableHighAccuracy:true,maximumAge:0,timeout:15000};
   watch.current=navigator.geolocation.watchPosition(p=>void publish(p),fail,options);
   if(session.current!==id){clear();return;}
   timer.current=setInterval(()=>{if(session.current===id&&!document.hidden)navigator.geolocation.getCurrentPosition(p=>void publish(p),fail,options);},30000);
  }catch{if(session.current===id)stop(id,'No pudimos activar la ubicación. Verificá que el reparto esté activo y aceptado.');}
 }
 return <section className="trip-location-sharing" aria-label="Compartir ubicación con el jefe"><h4>Ubicación para tu jefe</h4><p>Solo durante este reparto activo y con el mapa visible. Tu jefe verá tu punto aproximado y la parada seleccionada; eso no confirma que estés atendiendo al cliente.</p>
 <button className="hd-btn primary" disabled={starting} onClick={()=>sharing?stop():void start()}>{starting?'Activando ubicación…':sharing?'Dejar de compartir ubicación':'Compartir ubicación con mi jefe'}</button>{message&&<p role="status">{message}</p>}<small>Se detiene al ocultar o cerrar el mapa. No se guarda un recorrido histórico. Si se corta la conexión, el último punto deja de mostrarse en unos 90 segundos.</small></section>;
}
