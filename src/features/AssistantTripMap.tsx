import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import type {TripStop} from './AssistantTripView';
import 'leaflet/dist/leaflet.css';
const valid=(s:TripStop)=>s.latitude!=null&&s.longitude!=null&&Number.isFinite(s.latitude)&&Number.isFinite(s.longitude)&&Math.abs(s.latitude)<=90&&Math.abs(s.longitude)<=180;
export default function AssistantTripMap({stops,selectedId,onSelect}:{stops:TripStop[];selectedId?:string;onSelect:(id:string)=>void}){
 const node=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),points=useRef<L.LayerGroup|null>(null),gps=useRef<L.Circle|null>(null),fitted=useRef(false),mounted=useRef(false),callback=useRef(onSelect);callback.current=onSelect;
 const [locating,setLocating]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!node.current)return;mounted.current=true;const instance=L.map(node.current).setView([-34.6037,-58.3816],12);map.current=instance;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(instance);points.current=L.layerGroup().addTo(instance);
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>instance.invalidateSize());observer?.observe(node.current);
  return()=>{mounted.current=false;observer?.disconnect();instance.remove();map.current=null;points.current=null;gps.current=null;fitted.current=false;};
 },[]);
 useEffect(()=>{const instance=map.current,layer=points.current;if(!instance||!layer)return;layer.clearLayers();const bounds:L.LatLngTuple[]=[];
  stops.forEach((s,i)=>{if(!valid(s))return;const point:L.LatLngTuple=[s.latitude!,s.longitude!];bounds.push(point);const label=document.createElement('span');label.textContent=`${i+1}. ${s.name}`;
   L.circleMarker(point,{radius:s.id===selectedId?14:10,color:s.outcome==='delivered'?'#27856f':'#087eaa',weight:s.id===selectedId?4:2,fillOpacity:.75}).addTo(layer).bindTooltip(label).on('click',()=>callback.current(s.id));
  });if(bounds.length&&!fitted.current){instance.fitBounds(L.latLngBounds(bounds),{padding:[28,28],maxZoom:17});fitted.current=true;}
 },[stops,selectedId]);
 useEffect(()=>{const stop=stops.find(s=>s.id===selectedId);if(stop&&valid(stop))map.current?.setView([stop.latitude!,stop.longitude!],17);},[selectedId]);
 function locate(){if(locating)return;if(!navigator.geolocation){setMessage('Este navegador no permite consultar la ubicación.');return;}setLocating(true);setMessage('Consultando tu ubicación…');
  navigator.geolocation.getCurrentPosition(p=>{if(!mounted.current)return;setLocating(false);if(!map.current)return;gps.current?.remove();gps.current=L.circle([p.coords.latitude,p.coords.longitude],{radius:Math.max(p.coords.accuracy,5),color:'#235cc3',fillOpacity:.15}).addTo(map.current);map.current.setView([p.coords.latitude,p.coords.longitude],17);setMessage(`Ubicación consultada. Precisión aproximada: ${Math.round(p.coords.accuracy)} metros. No confirma que estés en la puerta del cliente.`);},()=>{if(mounted.current){setLocating(false);setMessage('No pudimos obtener tu ubicación. Revisá los permisos del celular o usá los pines del recorrido.');}},{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
 }
 return <div className="assistant-route-map-wrap"><div className="assistant-route-gps"><button className="hd-btn" disabled={locating} onClick={locate}>Ver mi ubicación actual</button>{message&&<p role="status">{message}</p>}<p>La ubicación se consulta al tocar el botón; todavía no se comparte con el jefe. El mapa muestra pines, sin optimización automática de ruta.</p></div><div ref={node} className="assistant-route-map" role="region" aria-label="Mapa de clientes del reparto aceptado"/>{stops.some(s=>!valid(s))&&<p>Hay clientes sin punto exacto. Conservan su dirección y se pueden abrir en una app de navegación.</p>}</div>;
}
