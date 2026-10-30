export type LocatedStop={id:string;name:string;address:string;locality?:string;latitude?:number|null;longitude?:number|null;outcome?:string;followup?:string|null};
export type RoutePosition={latitude:number;longitude:number;accuracy:number;timestamp:number};
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
export function hasRoutePoint(s:{latitude?:number|null;longitude?:number|null}){
 return s.latitude!=null&&s.longitude!=null&&Number.isFinite(s.latitude)&&Number.isFinite(s.longitude)&&Math.abs(s.latitude)<=90&&Math.abs(s.longitude)<=180;
}
export function routeDistance(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
 const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlng=(b.longitude-a.longitude)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlng/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export function streetBlock(address:string){
 const match=address.trim().match(/^(.+?)\s+(\d{1,6})$/);
 return match?{street:normalized(match[1]),number:Number(match[2]),block:Math.floor(Number(match[2])/100)}:null;
}
export function routeBlockCustomers<T extends LocatedStop>(stops:T[],selected:T){
 const base=streetBlock(selected.address);
 if(!base)return [selected];
 return stops.filter(s=>{
  if(s.id===selected.id)return true;
  const block=streetBlock(s.address);
  if(!block||block.street!==base.street||block.block!==base.block)return false;
  const locality=normalized(selected.locality||''),other=normalized(s.locality||'');
  if(locality&&other)return locality===other;
  return hasRoutePoint(selected)&&hasRoutePoint(s)&&routeDistance(selected as {latitude:number;longitude:number},s as {latitude:number;longitude:number})<=250;
 }).sort((a,b)=>(streetBlock(a.address)?.number||0)-(streetBlock(b.address)?.number||0)||a.name.localeCompare(b.name,'es'));
}
export function nearbyRouteStops<T extends LocatedStop>(stops:T[],position:RoutePosition,now=Date.now()){
 if(!hasRoutePoint(position)||!Number.isFinite(position.accuracy)||position.accuracy<0||position.accuracy>50||!Number.isFinite(position.timestamp)||now-position.timestamp>30000||position.timestamp>now+5000)return [];
 return stops.filter(s=>hasRoutePoint(s)&&(['pending','present'].includes(s.outcome||'pending')||(s.outcome==='absent'&&s.followup==='later_today')))
 .map(stop=>({stop,meters:routeDistance(position,stop as T&{latitude:number;longitude:number})})).filter(s=>s.meters<=60).sort((a,b)=>a.meters-b.meters);
}
