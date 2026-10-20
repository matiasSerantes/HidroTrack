import {demoDay,demoOwnedStock,isDone,type DemoProgramState,type Trip} from './programDemo';
export type DailyFinance={date:string;sold:number;cost:number;complete:boolean;activity:boolean;profit:number};
export function demoDashboard(s:DemoProgramState,today=demoDay){
 const month=today.slice(0,7),days=new Map<string,DailyFinance>();
 function day(date:string){if(!days.has(date))days.set(date,{date,sold:0,cost:0,complete:true,activity:false,profit:0});return days.get(date)!;}
 for(const t of s.trips.filter(t=>t.stage!=='planned')){const d=day(t.date||demoDay);d.activity=true;if(t.fillingCost)d.cost+=t.fillingCost.total;else d.complete=false;}
 for(const v of s.sales){const t=s.trips.find(t=>t.id===v.tripId),d=day(v.date||t?.date||demoDay);d.activity=true;d.sold+=v.total;if(!t?.fillingCost)d.complete=false;}
 for(const d of days.values())d.profit=d.sold-d.cost;
 const monthly=[...days.values()].filter(d=>d.date.startsWith(month)),date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 const week=Array.from({length:7},(_,i)=>{const current=new Date(date);current.setUTCDate(current.getUTCDate()+i);const id=current.toISOString().slice(0,10);return days.get(id)||{date:id,sold:0,cost:0,complete:true,activity:false,profit:0};});
 const best=week.filter(d=>d.activity&&d.complete).sort((a,b)=>b.profit-a.profit||a.date.localeCompare(b.date))[0];
 const stock=s.products.filter(p=>p.returnable&&p.kind==='sale'&&/bid[oó]n/i.test(p.name)).reduce((n,p)=>{const b=demoOwnedStock(s,p.id);return {full:n.full+b.depot+b.truck,empty:n.empty+b.empty+b.truckEmpty,customers:n.customers+b.held};},{full:0,empty:0,customers:0});
 return {month,sold:monthly.reduce((n,d)=>n+d.sold,0),cost:monthly.reduce((n,d)=>n+d.cost,0),profit:monthly.reduce((n,d)=>n+d.profit,0),complete:monthly.every(d=>d.complete),week,best,today:days.get(today),stock};
}
export function demoTripProgress(s:DemoProgramState,t:Trip){
 const ids=new Set(t.stops.map(p=>p.clientId));
 const delivered=new Set(s.sales.filter(v=>v.tripId===t.id&&v.items.some(i=>i.quantity>0)).map(v=>v.clientId));
 return {delivered:[...delivered].filter(id=>ids.has(id)).length,total:ids.size,resolved:t.stops.filter(isDone).length,newClients:s.clients.filter(c=>ids.has(c.id)&&c.joinedOn===(t.date||demoDay)).length};
}
