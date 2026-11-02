import './OwnerFleet.css';
import {lazy,Suspense,useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
const FleetMap=lazy(()=>import('./OwnerFleetMap'));
export type FleetItem={trip_id:string;trip_name:string;driver_id:string;driver_name:string;total:number;attended:number;latitude:number|null;longitude:number|null;accuracy:number|null;updated_at:string|null;customer:string|null};
export function OwnerFleet({client,tenantId}:{client:SupabaseClient;tenantId:string}){
 const [data,setData]=useState<{items:FleetItem[];server_now:string;fetchedAt:number}|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0),[selected,setSelected]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{let live=true,busy=false;async function load(){if(busy||document.hidden)return;busy=true;const requestedAt=Date.now();try{const r=await client.rpc('owner_live_trip_positions',{p_tenant:tenantId});if(r.error||!Array.isArray(r.data?.items)||!Number.isFinite(Date.parse(r.data.server_now)))throw new Error();if(live){setData({...r.data,fetchedAt:requestedAt});setNow(Date.now());setError('');}}catch{if(live){setData(null);setError('No pudimos verificar los repartos y sus ubicaciones. Actualizá para reintentar.');}}finally{busy=false;}}
  void load();const interval=setInterval(()=>void load(),15000),clock=setInterval(()=>{if(!document.hidden)setNow(Date.now());},5000),visibility=()=>{setData(null);if(!document.hidden)void load();},focus=()=>void load();document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',focus);
  return()=>{live=false;clearInterval(interval);clearInterval(clock);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',focus);};
 },[client,tenantId,version]);
 function age(item:FleetItem){return data&&item.updated_at?Math.max(0,Date.parse(data.server_now)-Date.parse(item.updated_at)+now-data.fetchedAt):Infinity;}
 const recent=data?.items.filter(i=>i.latitude!=null&&i.longitude!=null&&age(i)<90000)||[];
 return <section className="panel owner-fleet"><div className="section-heading"><div><h2>Repartos de tus asistentes</h2><p>Ubicación compartida voluntariamente durante un reparto activo.</p></div><button className="primary" onClick={()=>setVersion(v=>v+1)}>Actualizar ubicaciones</button></div>
 {error&&<p role="alert" className="stock-error">{error}</p>}{!data&&!error&&<p role="status">Consultando repartos activos…</p>}
 {data&&<><p>{data.items.length} repartos activos de asistentes · {recent.length} con ubicación reciente.</p>{recent.length>0?<Suspense fallback={<p role="status">Cargando mapa de asistentes…</p>}><FleetMap items={recent} selectedId={selected} onSelect={setSelected}/></Suspense>:<p className="notice">No hay ubicación reciente compartida. El asistente debe abrir el mapa de su reparto y activar Compartir ubicación con mi jefe.</p>}
 <div className="owner-fleet-cards">{data.items.map(item=>{const fresh=recent.some(i=>i.trip_id===item.trip_id);return <article key={item.trip_id}><h3>{item.driver_name}</h3><p>{item.trip_name}</p><strong>{item.attended} de {item.total} clientes atendidos</strong><p>{fresh?`Señal de hace ${Math.floor(age(item)/1000)} segundos · precisión aproximada ${Math.round(item.accuracy||0)} m`:'Sin ubicación reciente'}</p>{fresh&&item.customer&&<p>Parada seleccionada: {item.customer}. No confirma presencia.</p>}<button className="hd-btn" disabled={!fresh} onClick={()=>setSelected(item.trip_id)}>Ubicar en el mapa</button></article>;})}</div>
 {!data.items.length&&<p>Todavía no hay asistentes con un reparto activo aceptado.</p>}<p>Se consulta cada 15 segundos mientras esta pantalla está visible. Una señal vencida se retira del mapa; no se muestra como seguimiento en vivo.</p></>}
 </section>;
}
