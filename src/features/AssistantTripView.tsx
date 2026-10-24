import {lazy,Suspense,useState} from 'react';
import {ExternalNavigation} from './ExternalNavigation';
import './AssistantTripView.css';
const RouteMap=lazy(()=>import('./AssistantTripMap'));
export type TripStop={id:string;name:string;address:string;locality?:string;phone:string;latitude?:number|null;longitude?:number|null;position:number;outcome:string;followup?:string|null;next_date?:string|null;pending_recovery:boolean};
export type AssistantTrip={trip:{name:string;date:string;status:string};stops:TripStop[];stock?:{product_id:string;name:string;unit:string;family:string;returnable:boolean;loaded:number;ready:number;empties:number}[]};
const outcomes:Record<string,string>={pending:'Pendiente',present:'Presente',absent:'Ausente',no_purchase:'No compró',delivered:'Entregado'};
export function AssistantTripView({data,selectedId,onSelect,onClose}:{data:AssistantTrip;selectedId?:string;onSelect:(id:string)=>void;onClose:()=>void}){
 const [showMap,setShowMap]=useState(false),[showStock,setShowStock]=useState(false);
 const selected=data.stops.find(s=>s.id===selectedId)??data.stops.find(s=>['pending','present'].includes(s.outcome))??data.stops[0];
 const targets=data.stops.map(s=>({id:s.id,name:s.name,address:s.address,locality:s.locality,geo:s.latitude!=null&&s.longitude!=null?{lat:s.latitude,lng:s.longitude}:undefined}));
 const delivered=data.stops.filter(s=>s.outcome==='delivered').length;
 const pendingIds=new Set(data.stops.filter(s=>['pending','present'].includes(s.outcome)||(s.outcome==='absent'&&s.followup==='later_today')).map(s=>s.id));
 return <section className="assistant-trip-view"><div className="invitation-heading"><h3>{data.trip.name}</h3><button className="hd-btn" onClick={onClose}>Cerrar recorrido</button></div>
 <p>{data.trip.status==='planned'?'Esperando la carga del camión por el jefe.':data.trip.status==='submitted'?'Reparto presentado para rendir.':'En recorrido'}</p><p><strong>Entregados: {delivered} de {data.stops.length} clientes</strong></p>
 <div className="assistant-route-actions"><button className="hd-btn primary" aria-expanded={showMap} onClick={()=>setShowMap(v=>!v)}>{showMap?'Ocultar mapa':'Ver mapa del reparto'}</button><button className="hd-btn primary" aria-expanded={showStock} onClick={()=>setShowStock(v=>!v)}>Stock del camión</button></div>
 {showStock&&<section className="assistant-route-stock"><h4>Stock de este camión</h4>{!(data.stock?.length)&&<p>Todavía no hay carga registrada para este reparto.</p>}{data.stock?.map(p=><article key={p.product_id}><strong>{p.name}</strong><p>{p.family==='dispenser'?`${p.ready} disponibles`:`${p.ready} llenos / unidades listas${p.returnable?` · ${p.empties} vacíos`:''}`}</p><small>Carga inicial: {p.loaded} {p.unit}</small></article>)}<p>Se consulta el saldo del servidor al actualizar. La carga confirmada no se edita desde acá.</p></section>}
 {showMap&&<Suspense fallback={<p role="status">Cargando mapa…</p>}><RouteMap stops={data.stops} selectedId={selected?.id} onSelect={onSelect}/></Suspense>}
 <label>Parada del recorrido<select value={selected?.id??''} onChange={e=>onSelect(e.target.value)}>{data.stops.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.name} · {outcomes[s.outcome]??s.outcome}</option>)}</select></label>
 {selected&&<article className="assistant-route-selected"><h4>{data.stops.indexOf(selected)+1}. {selected.name}</h4><p>{selected.address}{selected.locality?` · ${selected.locality}`:''}</p>{selected.phone&&<p>Teléfono: {selected.phone}</p>}<p>{outcomes[selected.outcome]??selected.outcome}{selected.followup==='later_today'?' · Volver más tarde':selected.next_date?` · Próxima visita: ${selected.next_date}`:''}</p>{selected.pending_recovery&&<p className="assistant-real-error">Pendiente de recuperación · No entregar</p>}<ExternalNavigation selected={targets.find(t=>t.id===selected.id)} route={targets.filter(t=>pendingIds.has(t.id))}/></article>}
 {!data.stops.length&&<p>No hay clientes activos asignados a este reparto.</p>}
 <p className="assistant-route-help">La selección se puede retomar al reabrir. Entregas, devoluciones y cobros todavía se están conectando; abrir el mapa no registra una visita.</p>
 </section>;
}
