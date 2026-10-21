import { useId, useState } from 'react';
import { googleNavigation, navigationLegs, wazeNavigation, type NavigationTarget } from '../domain/externalNavigation';
import './ExternalNavigation.css';

export function ExternalNavigation({selected,route,demo=false,disabled=false}:{selected?:NavigationTarget;route?:NavigationTarget[];demo?:boolean;disabled?:boolean}){
  const [open,setOpen]=useState(false),[showRoute,setShowRoute]=useState(false),id=useId();
  let google='',waze:{href:string;precise:boolean}|undefined,selectionError='',routeError='';
  let legs:ReturnType<typeof navigationLegs>=[];
  if(open&&selected){try{google=googleNavigation([selected]);waze=wazeNavigation(selected);}catch(e){selectionError=(e as Error).message;}}
  if(open&&showRoute&&route){try{legs=navigationLegs(route);}catch(e){routeError=(e as Error).message;}}
  return <section className="external-navigation" aria-label="Navegación en otra app"><button type="button" className="external-navigation-toggle" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>Abrir navegación ↗</button>{open&&<div id={id} className="external-navigation-panel">
    {demo&&<p className="external-navigation-demo">Destinos de demostración. La app usará tu ubicación real como partida, no el punto simulado.</p>}
    {selected&&<><strong>Parada seleccionada: {selected.name}</strong><p>{selected.address} {selected.locality}</p><div className="external-navigation-links">{google&&<a href={google} target="_blank" rel="noopener noreferrer">Ir a esta parada en Google Maps ↗</a>}{waze&&<a href={waze.href} target="_blank" rel="noopener noreferrer">{waze.precise?'Ir a esta parada en Waze':'Buscar dirección en Waze'} ↗</a>}</div>{selectionError&&<p role="alert">{selectionError}</p>}</>}
    {route!==undefined&&<><button type="button" disabled={!route.length} className="external-navigation-route" aria-expanded={showRoute} onClick={()=>setShowRoute(!showRoute)}>Ver recorrido pendiente en app ({route.length} paradas)</button>{!route.length&&<p>No quedan paradas pendientes para hoy.</p>}{showRoute&&<div>{routeError?<p role="alert">{routeError} El recorrido no se abrió: no se omiten paradas.</p>:<><p>Google Maps · orden del reparto. {legs.length>1?'Se divide en tramos de hasta cuatro paradas. Al terminar cada tramo, volvé aquí y abrí el siguiente.':'Revisá las paradas antes de iniciar.'}</p>{legs.map((leg,i)=><div className="external-navigation-leg" key={leg.first}><a href={leg.href} target="_blank" rel="noopener noreferrer">{legs.length===1?`Abrir recorrido completo (${leg.targets.length} paradas)`:`Abrir tramo ${i+1} · paradas ${leg.first} a ${leg.last}`} ↗</a><ol start={leg.first}>{leg.targets.map(t=><li key={t.id}>{t.name} · {t.address}</li>)}</ol></div>)}</>}</div>}</>}
    {waze&&!waze.precise&&<p>No hay punto exacto guardado: confirmá que la dirección encontrada sea la correcta antes de iniciar.</p>}
    <p>Se comparte el destino con la app elegida. Según tu celular, abrirá la app instalada o su página web. Volvé a HidroTrack para registrar la entrega: abrir navegación no completa visitas.</p>
  </div>}</section>;
}
