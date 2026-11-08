export function argentinaClock(now=new Date()){
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=(key:string)=>parts.find(p=>p.type===key)?.value??'';
 return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))};
}
export function addVisitDays(date:string,days:number){const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
export type VisitCycle={every_weeks?:number;anchor_date?:string|null};
export function visitCycleDue(date:string,cycle?:VisitCycle){if(!cycle||cycle.every_weeks===undefined||cycle.every_weeks===1)return true;if(cycle.every_weeks!==2||!cycle.anchor_date||date<cycle.anchor_date)return false;const monday=(v:string)=>{const d=new Date(`${v}T12:00:00Z`);return d.getTime()-((d.getUTCDay()||7)-1)*86400000;};const weeks=Math.round((monday(date)-monday(cycle.anchor_date))/604800000);return Number.isFinite(weeks)&&weeks%2===0;}
export function nextHabitualDate(days:number[],today:string,cycle?:VisitCycle){const start=cycle?.every_weeks===2&&cycle.anchor_date&&cycle.anchor_date>today?cycle.anchor_date:today;for(let offset=0;offset<14;offset++){const date=addVisitDays(start,offset),weekday=new Date(`${date}T12:00:00Z`).getUTCDay()||7;if(days.includes(weekday)&&visitCycleDue(date,cycle))return date;}return null;}
export function readPlanningLink(search:string){const query=new URLSearchParams(search),date=query.get('planificar')??'',tenant=query.get('empresa')??'';const parsed=new Date(`${date}T12:00:00Z`);return {date:/^20\d{2}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:undefined,tenant:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant)?tenant:undefined};}
