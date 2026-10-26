import {useEffect,useRef} from 'react';
import L from 'leaflet';
import {CUSTOMER_MAP_ORIGIN,type CustomerPoint} from './CustomerLocationPicker';
import 'leaflet/dist/leaflet.css';
export default function CustomerLocationMap({initial,onSelect,disabled=false}:{initial?:CustomerPoint;disabled?:boolean;onSelect:(p:CustomerPoint)=>void}){
 const node=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.CircleMarker|null>(null),callback=useRef(onSelect);callback.current=onSelect;const locked=useRef(disabled);locked.current=disabled;
 useEffect(()=>{
  if(!node.current)return;
  const point=initial||CUSTOMER_MAP_ORIGIN,instance=L.map(node.current).setView([point.lat,point.lng],16);map.current=instance;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(instance);
  instance.on('click',(e:L.LeafletMouseEvent)=>{if(!locked.current)callback.current({lat:e.latlng.lat,lng:e.latlng.lng});});
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>instance.invalidateSize());observer?.observe(node.current);
  return()=>{observer?.disconnect();instance.remove();map.current=null;marker.current=null;};
 },[]);
 useEffect(()=>{if(!map.current||!initial)return;marker.current?.remove();marker.current=L.circleMarker([initial.lat,initial.lng],{radius:11,color:'#078793',fillOpacity:.7}).addTo(map.current);map.current.setView([initial.lat,initial.lng],17);},[initial]);
 return <div ref={node} className="customer-location-map" role="region" aria-label="Mapa para marcar la puerta del cliente"/>;
}
