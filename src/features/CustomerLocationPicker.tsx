import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {addressSearchUrl,parseAddressResults,type AddressResult} from '../domain/addressSearch';
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
export function CustomerLocationPicker({initial,demo=false,disabled=false,onBusy}:{initial?:CustomerPoint;demo?:boolean;disabled?:boolean;onBusy?:(value:boolean)=>void}){
 const [point,setPoint]=useState(initial),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [searching,setSearching]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<AddressResult[]|null>(null),[notice,setNotice]=useState('');
 const container=useRef<HTMLDivElement>(null),abort=useRef<AbortController|null>(null),mounted=useRef(true),requesting=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{onBusy?.(busy||searching);return()=>onBusy?.(false);},[busy,searching,onBusy]);
 const lat=useRef<HTMLInputElement>(null),lng=useRef<HTMLInputElement>(null);
 function select(p:CustomerPoint){setPoint(p);if(lat.current)lat.current.value=String(p.lat);if(lng.current)lng.current.value=String(p.lng);setError('');}
 function syncCoordinates(){const a=lat.current?.value,b=lng.current?.value;if(a&&b&&Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a))<=90&&Math.abs(Number(b))<=180)setPoint({lat:Number(a),lng:Number(b)});}
 function locate(){
  if(disabled||busy||searching)return;
  if(!navigator.geolocation){setError('Este navegador no ofrece ubicación. Elegí el punto en el mapa o ingresá las coordenadas.');return;}
  setBusy(true);setError('');navigator.geolocation.getCurrentPosition(p=>{if(!mounted.current)return;setBusy(false);select({lat:p.coords.latitude,lng:p.coords.longitude});setShow(true);setNotice(`Punto tomado desde tu teléfono. Revisá que sea la puerta del cliente${Number.isFinite(p.coords.accuracy)?`. Precisión aproximada: ${Math.round(p.coords.accuracy)} metros`:''}.`);},()=>{if(!mounted.current)return;setBusy(false);setError('No pudimos obtener tu ubicación. Revisá el permiso o marcá el punto en el mapa.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 async function searchAddress(){
  if(disabled||busy||requesting.current)return;setError('');setNotice('');setResults(null);
  const form=container.current?.closest('form'),value=(name:string)=>{const field=form?.elements.namedItem(name);return field instanceof HTMLInputElement?field.value.trim():'';};
  const address=query.trim()||[value('address'),value('locality')].filter(Boolean).join(', ');
  let url:string;try{url=addressSearchUrl(address);}catch(e){setError((e as Error).message);return;}
  setQuery(address);requesting.current=true;setSearching(true);const controller=new AbortController();abort.current=controller;const timer=window.setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error();const found=parseAddressResults(await response.json());if(mounted.current){setResults(found);setNotice(found.length?'Elegí el resultado correcto y ajustá el punto exacto en el mapa.':'No encontramos esa dirección. Agregá localidad y provincia, o marcá el punto manualmente.');}}
  catch{if(mounted.current)setError('No pudimos buscar la dirección. Revisá la conexión o marcá el punto en el mapa. Tu ubicación guardada no cambió.');}
  finally{window.clearTimeout(timer);requesting.current=false;if(mounted.current)setSearching(false);}
 }
 return <div ref={container} className="customer-location"><h3>Ubicación exacta del cliente</h3><p>La dirección escrita se conserva. Marcá la puerta del cliente; la posición actual corresponde al teléfono desde donde estás cargando.</p><section className="customer-address-search" aria-label="Buscar domicilio en el mapa"><label>Dirección para buscar en el mapa<input value={query} onChange={e=>{setQuery(e.target.value);setResults(null);}} maxLength={300} disabled={disabled||busy||searching} placeholder="Usa la dirección escrita arriba o ingresá calle, número y localidad" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void searchAddress();}}}/></label><button type="button" className="hd-btn primary" disabled={disabled||busy||searching} onClick={()=>void searchAddress()}>{searching?'Buscando dirección…':'Buscar dirección en el mapa'}</button><p>Si dejás este campo vacío, buscamos la dirección del cliente escrita arriba. Incluí localidad y provincia para evitar confusiones.</p>{results&&results.length>0&&<ul className="customer-address-results">{results.map((result,index)=><li key={`${result.lat}.${result.lng}.${index}`}><button type="button" disabled={disabled||busy||searching} onClick={()=>{select(result);setShow(true);setResults(null);setNotice(`Ubicación aproximada: ${result.label}. Ajustá el punto de la puerta antes de guardar el cliente.`);}}>{result.label}{!result.hasNumber&&<small>Sin número de puerta en el resultado. Ajustá el punto.</small>}</button></li>)}</ul>}</section><div className="hd-actions"><button type="button" className="hd-btn" disabled={disabled||busy||searching} onClick={()=>setShow(!show)}>{show?'Cerrar mapa':'Ubicar en el mapa'}</button><button type="button" className="hd-btn" disabled={disabled||busy||searching} onClick={locate}>{busy?'Buscando ubicación…':'Usar posición actual'}</button>{demo&&<button type="button" className="hd-btn" disabled={disabled||busy||searching} onClick={()=>select(CUSTOMER_MAP_ORIGIN)}>Usar ubicación de ejemplo</button>}</div><div className="hd-form-grid"><label>Latitud<input ref={lat} name="latitude" type="number" step="any" min="-90" max="90" defaultValue={initial?.lat} disabled={disabled||busy||searching} onBlur={syncCoordinates}/></label><label>Longitud<input ref={lng} name="longitude" type="number" step="any" min="-180" max="180" defaultValue={initial?.lng} disabled={disabled||busy||searching} onBlur={syncCoordinates}/></label></div>{show&&<Suspense fallback={<p role="status">Abriendo mapa…</p>}><LocationMap initial={point} disabled={disabled||busy||searching} onSelect={p=>{if(!disabled&&!busy&&!searching){select(p);setNotice('Punto elegido. Se guardará cuando guardes el cliente.');}}}/></Suspense>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<p>Elegí un punto con un toque en el mapa. También podés escribir las coordenadas. La búsqueda necesita conexión y comparte solo la dirección con el servicio de mapas al tocar Buscar. Verificá el resultado antes de guardar.</p><p className="customer-map-credit">Búsqueda: <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">Photon</a> y datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</p></div>;
}
