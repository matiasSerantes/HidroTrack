import {useState} from 'react';
import {routeBlockCustomers,streetBlock} from '../domain/routeNearby';
import type {TripStop} from './AssistantTripView';
export function RouteBlockCustomers({stops,selectedId,onSelect,disabled=false}:{stops:TripStop[];selectedId?:string;onSelect:(id:string)=>void;disabled?:boolean}){
 const [expanded,setExpanded]=useState(false);
 const selected=stops.find(s=>s.id===selectedId);
 if(!selected)return null;
 const clients=routeBlockCustomers(stops,selected),base=streetBlock(selected.address);
 return <section className="route-block-customers" aria-label="Clientes de la cuadra del recorrido">
 <button className="hd-btn primary" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Ocultar clientes de esta cuadra':'Ver clientes de esta cuadra'}</button>
 {expanded&&<><h4>Clientes de esta cuadra</h4><p>Solo incluye las paradas de este reparto. {base?`Alturas ${base.block*100} a ${base.block*100+99}.`:'Falta una dirección con calle y altura para agrupar.'}</p>
 <p>{clients.length} {clients.length===1?'cliente identificado':'clientes identificados'}. Confirmá el domicilio antes de atender.</p>
 {clients.map(c=><article key={c.id}><div><strong>{c.name}</strong><p>{c.address}{c.locality?` · ${c.locality}`:''}</p><small>{c.outcome==='delivered'?'Atendido':c.outcome==='no_purchase'?'No compró':c.outcome==='absent'?'Ausente':'Por atender'}{c.pending_recovery?' · Recuperación pendiente':''}</small></div><button className="hd-btn" disabled={disabled} onClick={()=>onSelect(c.id)}>Ver parada de {c.name}</button></article>)}
 {clients.length===1&&<p>No se identificaron otras paradas de esta cuadra con los datos disponibles.</p>}</>}
 </section>;
}
