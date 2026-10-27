export function argentinaClock(now=new Date()){
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=(key:string)=>parts.find(p=>p.type===key)?.value??'';
 return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))};
}
export function addVisitDays(date:string,days:number){const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
export function nextHabitualDate(days:number[],today:string){for(let offset=0;offset<7;offset++){const date=addVisitDays(today,offset),weekday=new Date(`${date}T12:00:00Z`).getUTCDay()||7;if(days.includes(weekday))return date;}return null;}
