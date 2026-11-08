import {useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {hasPlanningPoint,type PlanningPoint} from '../domain/planningMap';
export default function TripPlanningMap({customers,order,disabled,onSelect}:{customers:PlanningPoint[];order:string[];disabled:boolean;onSelect:(id:string)=>void}){
 const node=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),layer=useRef<L.LayerGroup|null>(null),fitted=useRef(false),callback=useRef(onSelect),locked=useRef(disabled);callback.current=onSelect;locked.current=disabled;
 useEffect(()=>{if(!node.current)return;const m=L.map(node.current).setView([-34.6037,-58.3816],12);map.current=m;L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);layer.current=L.layerGroup().addTo(m);const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>m.invalidateSize());observer?.observe(node.current);return()=>{observer?.disconnect();m.remove();map.current=null;layer.current=null;fitted.current=false;};},[]);
 useEffect(()=>{if(!map.current||!layer.current)return;const group=layer.current;group.clearLayers();const bounds:L.LatLngTuple[]=[];
  for(const c of customers){if(!hasPlanningPoint(c))continue;const i=order.indexOf(c.id),point:L.LatLngTuple=[c.latitude!,c.longitude!];bounds.push(point);const text=document.createElement('span');text.textContent=`${i>=0?`${i+1}. `:''}${c.name}${c.address?` · ${c.address}`:''}${i>=0?' · Elegido':' · Tocar para agregar'}`;
   const marker=L.circleMarker(point,{radius:i>=0?13:9,color:i>=0?'#087eaa':'#6292a8',weight:i>=0?3:2,fillOpacity:i>=0?.8:.3}).addTo(group).bindTooltip(text).on('click',()=>{if(!locked.current)callback.current(c.id);});
   if(i>=0){marker.bindTooltip(String(i+1),{permanent:true,direction:'center',className:'planner-point-number'});marker.bindPopup(text);}
  }
  const line=order.map(id=>customers.find(c=>c.id===id)).filter((c):c is PlanningPoint=>!!c&&hasPlanningPoint(c)).map(c=>[c.latitude!,c.longitude!] as L.LatLngTuple);if(line.length>1)L.polyline(line,{color:'#138b9b',weight:3,dashArray:'6 8',interactive:false}).addTo(group);
  if(bounds.length&&!fitted.current){map.current.fitBounds(L.latLngBounds(bounds),{padding:[35,35],maxZoom:17});fitted.current=true;}
 },[customers,order]);
 function fit(){const points=customers.filter(hasPlanningPoint).map(c=>[c.latitude!,c.longitude!] as L.LatLngTuple);if(points.length)map.current?.fitBounds(L.latLngBounds(points),{padding:[35,35],maxZoom:17});}
 return <section className="trip-planning-map"><button type="button" onClick={fit}>Ver todos los puntos</button><div ref={node} style={{height:'min(55vh,420px)',minHeight:280,width:'100%',borderRadius:12}} role="region" aria-label="Mapa para seleccionar clientes del nuevo reparto"/><p>La numeración sigue el orden elegido. La línea une los puntos como referencia; no calcula el camino por las calles. Tocá un cliente para agregarlo o quitarlo.</p></section>;
}
