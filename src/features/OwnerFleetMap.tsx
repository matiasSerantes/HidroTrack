import {useEffect,useRef} from 'react';
import L from 'leaflet';
import type {FleetItem} from './OwnerFleet';
import {hasRoutePoint} from '../domain/routeNearby';
import 'leaflet/dist/leaflet.css';
export default function OwnerFleetMap({items,selectedId,onSelect}:{items:FleetItem[];selectedId:string;onSelect:(id:string)=>void}){
 const node=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),layers=useRef<L.LayerGroup|null>(null),fitted=useRef(false),callback=useRef(onSelect);callback.current=onSelect;
 useEffect(()=>{if(!node.current)return;const instance=L.map(node.current).setView([-34.6037,-58.3816],12);map.current=instance;L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(instance);layers.current=L.layerGroup().addTo(instance);const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>instance.invalidateSize());resize?.observe(node.current);
  return()=>{resize?.disconnect();instance.remove();map.current=null;layers.current=null;fitted.current=false;};
 },[]);
 useEffect(()=>{const instance=map.current,layer=layers.current;if(!instance||!layer)return;layer.clearLayers();const bounds:L.LatLngTuple[]=[];
  for(const item of items){if(!hasRoutePoint(item))continue;const point:L.LatLngTuple=[item.latitude!,item.longitude!];bounds.push(point);const label=document.createElement('span');label.textContent=`${item.driver_name} · ${item.trip_name}`;L.circle(point,{radius:Math.max(5,item.accuracy||5),color:'#0a87a2',weight:item.trip_id===selectedId?4:2,fillOpacity:.18}).addTo(layer).bindTooltip(label).on('click',()=>callback.current(item.trip_id));}
  if(bounds.length&&!fitted.current){instance.fitBounds(L.latLngBounds(bounds),{padding:[30,30],maxZoom:17});fitted.current=true;}
 },[items,selectedId]);
 useEffect(()=>{const item=items.find(i=>i.trip_id===selectedId);if(item&&hasRoutePoint(item))map.current?.setView([item.latitude!,item.longitude!],17);},[selectedId,items]);
 return <div ref={node} className="owner-fleet-map" role="region" aria-label="Mapa de ubicaciones recientes de asistentes"/>;
}
