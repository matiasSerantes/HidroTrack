type Stop={id:string;name:string;outcome:string;reminder_dismissed?:boolean;visit_start?:string|null;visit_end?:string|null;visit_starts_at?:string|null};
export function dueVisitReminders<T extends Stop>(stops:T[],now:number,tripDate:string){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(day>tripDate)return [];
 return stops.filter(s=>['pending','present'].includes(s.outcome)&&!s.reminder_dismissed&&s.visit_start&&s.visit_end&&Number.isFinite(Date.parse(s.visit_starts_at||''))&&now>=Date.parse(s.visit_starts_at!)-3600000).map(s=>({...s,slot:Math.floor((now-(Date.parse(s.visit_starts_at!)-3600000))/1800000)}));
}
