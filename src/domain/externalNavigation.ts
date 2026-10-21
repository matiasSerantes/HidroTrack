export type NavigationTarget={id:string;name:string;address:string;locality?:string;geo?:{lat:number;lng:number}};
export function pendingNavigationTargets(clients:NavigationTarget[],stops:{clientId:string;status:string}[]){
  return stops.filter(s=>['pending','later'].includes(s.status)).map(s=>clients.find(c=>c.id===s.clientId)||{id:s.clientId,name:'Parada sin datos disponibles',address:''});
}
export function destination(target:NavigationTarget){
  const p=target.geo;
  if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180)return `${p.lat},${p.lng}`;
  if(!target.address.trim())throw new Error(`Falta la ubicación de ${target.name}. Completá su dirección o punto de mapa.`);
  // A pipe is the Google waypoint separator; literal pipes must not add stops.
  return [target.address,target.locality,'Argentina'].filter(Boolean).join(', ').replaceAll('|',' ');
}
export function googleNavigation(targets:NavigationTarget[]){
  if(!targets.length||targets.length>4)throw new Error('Elegí entre una y cuatro paradas por tramo.');
  const locations=targets.map(destination),url=new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api','1');url.searchParams.set('destination',locations.at(-1)!);
  url.searchParams.set('travelmode','driving');
  if(locations.length===1)url.searchParams.set('dir_action','navigate');
  if(locations.length>1)url.searchParams.set('waypoints',locations.slice(0,-1).join('|'));
  if(url.href.length>2048)throw new Error('La dirección es demasiado larga para abrirla. Guardá su punto en el mapa.');
  // No origin: Maps uses the phone's location, never the simulated demo marker.
  return url.href;
}
export function wazeNavigation(target:NavigationTarget){
  const value=destination(target),url=new URL('https://www.waze.com/ul');
  const p=target.geo;
  const precise=p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
  url.searchParams.set(precise?'ll':'q',value);if(precise)url.searchParams.set('navigate','yes');
  return {href:url.href,precise:Boolean(precise)};
}
export function navigationLegs(targets:NavigationTarget[]){
  const legs:{targets:NavigationTarget[];href:string;first:number;last:number}[]=[];
  for(let start=0;start<targets.length;){
    let end=Math.min(start+4,targets.length),href='';
    for(;;){try{href=googleNavigation(targets.slice(start,end));break;}catch(e){if(end-start===1)throw e;end--;}}
    legs.push({targets:targets.slice(start,end),href,first:start+1,last:end});start=end;
  }
  return legs;
}
