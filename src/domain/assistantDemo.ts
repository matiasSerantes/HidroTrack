import { uid, type DemoProgramState } from './programDemo';

export const assistantPlans = {basic:{name:'Básica',limit:1},intermediate:{name:'Intermedia',limit:3},unlimited:{name:'Superior',limit:Infinity}} as const;
export const assistantPlan = (s:DemoProgramState) => s.assistantPlan || 'intermediate';
export const assistantAccounts = (s:DemoProgramState) => s.assistantAccounts || [
  ...s.members.filter(m=>m.role==='driver').map(m=>({id:m.id,name:m.name,email:m.email||`${m.id}@example.com`})),
  {id:'sofia',name:'Sofía Torres',email:'sofia@example.com'},
];
export const otherEmployerLinks = (s:DemoProgramState) => s.otherEmployerLinks || [{accountId:'luz',company:'Agua del Sur · demo'}];
export const assignedAssistantTrips = (s:DemoProgramState,id:string) => s.members.some(m=>m.id===id&&m.role==='driver'&&m.active)?s.trips.filter(t=>t.driverId===id&&t.stage!=='approved'):[];
function owner(s:DemoProgramState,actor:string){if(!s.members.some(m=>m.id===actor&&m.role==='owner'&&m.active))throw new Error('Solo el jefe puede administrar su equipo.');}
export function changeAssistantPlan(s:DemoProgramState,plan:keyof typeof assistantPlans,actor:string){
  owner(s,actor);
  if(s.members.filter(m=>m.role==='driver'&&m.active).length>assistantPlans[plan].limit)throw new Error('Quitá asistentes antes de elegir un plan con menos lugares.');
  return {...s,assistantPlan:plan};
}
export function linkAssistant(s:DemoProgramState,email:string,actor:string){
  owner(s,actor);const account=assistantAccounts(s).find(a=>a.email===email.trim().toLowerCase());
  if(!account)throw new Error('No existe esa cuenta en la demo. El asistente debe crear primero su cuenta.');
  if(s.members.some(m=>m.id===account.id&&m.active))throw new Error('Este asistente ya está en tu equipo.');
  if(s.members.filter(m=>m.role==='driver'&&m.active).length>=assistantPlans[assistantPlan(s)].limit)throw new Error('Tu licencia no tiene lugares disponibles para otro asistente.');
  const next=structuredClone(s);next.assistantAccounts=assistantAccounts(s);next.otherEmployerLinks=otherEmployerLinks(s);
  const member=next.members.find(m=>m.id===account.id);
  if(member)member.active=true;else next.members.push({...account,role:'driver',active:true});
  return next;
}
export function unlinkAssistant(s:DemoProgramState,id:string,actor:string){
  owner(s,actor);
  if(!s.members.some(m=>m.id===id&&m.role==='driver'&&m.active))throw new Error('Asistente no vinculado.');
  if(s.trips.some(t=>t.driverId===id&&t.stage!=='approved'))throw new Error('Reasigná o cerrá sus recorridos y rendiciones antes de quitarlo.');
  return {...s,assistantAccounts:assistantAccounts(s),otherEmployerLinks:otherEmployerLinks(s),members:s.members.map(m=>m.id===id?{...m,active:false,promotionAllowed:false}:m)};
}
export function registerDemoAssistant(s:DemoProgramState,name:string,email:string){
  name=name.trim();email=email.trim().toLowerCase();
  if(!name||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Completá nombre y correo válidos.');
  if(assistantAccounts(s).some(a=>a.email===email))throw new Error('Ya existe una cuenta con ese correo en la demo.');
  const account={id:uid(),name,email};
  return {account,state:{...s,assistantAccounts:[...assistantAccounts(s),account]}};
}
