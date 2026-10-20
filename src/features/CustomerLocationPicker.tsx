import {lazy,Suspense,useRef,useState} from 'react';
import './CustomerLocationPicker.css';
const LocationMap=lazy(()=>import('./CustomerLocationMap'));
export type CustomerPoint={lat:number;lng:number};
export const CUSTOMER_MAP_ORIGIN={lat:-34.60905,lng:-58.3832};
export function readCustomerLocation(data:FormData):CustomerPoint|undefined{
 const latitude=String(data.get('latitude')||'').trim(),longitude=String(data.get('longitude')||'').trim();
 if(!latitude&&!longitude)return undefined;
 const lat=Number(latitude),lng=Number(longitude);
 if(!latitude||!longitude||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('Completá latitud y longitud válidas o dejá ambas vacías.');
 return {lat,lng};
}
export function CustomerLocationPicker({initial,demo=false,disabled=false}:{initial?:CustomerPoint;demo?:boolean;disabled?:boolean}){
 const [point,setPoint]=useState(initial),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lat=useRef<HTMLInputElement>(null),lng=useRef<HTMLInputElement>(null);
 function select(p:CustomerPoint){setPoint(p);if(lat.current)lat.current.value=String(p.lat);if(lng.current)lng.current.value=String(p.lng);setError('');}
 function syncCoordinates(){const a=lat.current?.value,b=lng.current?.value;if(a&&b&&Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a))<=90&&Math.abs(Number(b))<=180)setPoint({lat:Number(a),lng:Number(b)});}
 function locate(){
  if(!navigator.geolocation){setError('Este navegador no ofrece ubicación. Elegí el punto en el mapa o ingresá las coordenadas.');return;}
  setBusy(true);setError('');navigator.geolocation.getCurrentPosition(p=>{setBusy(false);select({lat:p.coords.latitude,lng:p.coords.longitude});},()=>{setBusy(false);setError('No pudimos obtener tu ubicación. Revisá el permiso o marcá el punto en el mapa.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 return <div className="customer-location"><h3>Ubicación exacta del cliente</h3><p>La dirección escrita se conserva. Marcá la puerta del cliente; la posición actual corresponde al teléfono desde donde estás cargando.</p><div className="hd-actions"><button type="button" className="hd-btn" disabled={disabled} onClick={()=>setShow(!show)}>{show?'Cerrar mapa':'Ubicar en el mapa'}</button><button type="button" className="hd-btn" disabled={disabled||busy} onClick={locate}>{busy?'Buscando ubicación…':'Usar posición actual'}</button>{demo&&<button type="button" className="hd-btn" onClick={()=>select(CUSTOMER_MAP_ORIGIN)}>Usar ubicación de ejemplo</button>}</div><div className="hd-form-grid"><label>Latitud<input ref={lat} name="latitude" type="number" step="any" min="-90" max="90" defaultValue={initial?.lat} disabled={disabled} onBlur={syncCoordinates}/></label><label>Longitud<input ref={lng} name="longitude" type="number" step="any" min="-180" max="180" defaultValue={initial?.lng} disabled={disabled} onBlur={syncCoordinates}/></label></div>{show&&<Suspense fallback={<p role="status">Abriendo mapa…</p>}><LocationMap initial={point} onSelect={select}/></Suspense>}{error&&<p role="alert">{error}</p>}<p>Elegí un punto con un toque en el mapa. También podés escribir las coordenadas. El mapa necesita conexión; no busca la dirección automáticamente.</p></div>;
}
