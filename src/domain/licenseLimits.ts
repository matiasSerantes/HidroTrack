import type {DemoProgramState} from './programDemo';
export type PlanResource='clients'|'drivers'|'articles'|'dispensers'|'active_trips'|'planned_trips'|'promotions';
export type PlanLimits=Record<PlanResource,number|null>;
export const licenseLimits:Record<'basic'|'intermediate'|'unlimited',PlanLimits>={
 basic:{clients:100,drivers:1,articles:3,dispensers:3,active_trips:1,planned_trips:5,promotions:2},
 intermediate:{clients:300,drivers:4,articles:6,dispensers:6,active_trips:3,planned_trips:15,promotions:6},
 unlimited:{clients:null,drivers:null,articles:null,dispensers:null,active_trips:null,planned_trips:null,promotions:null}
};
export const resourceLabels:Record<PlanResource,string>={clients:'Clientes activos',drivers:'Choferes vinculados',articles:'Modelos de productos',dispensers:'Modelos de dispenser',active_trips:'Repartos activos o pendientes de cierre',planned_trips:'Repartos preparados sin iniciar',promotions:'Promociones reutilizables activas'};
export function demoPlanUsage(s:DemoProgramState):Record<PlanResource,number>{return {clients:s.clients.filter(c=>c.active).length,drivers:s.members.filter(m=>m.active&&m.role==='driver').length,articles:s.products.filter(p=>p.active&&p.kind!=='rental').length,dispensers:s.products.filter(p=>p.active&&p.kind==='rental').length,active_trips:s.trips.filter(t=>['active','submitted'].includes(t.stage)).length,planned_trips:s.trips.filter(t=>t.stage==='planned').length,promotions:(s.saleCombos||[]).filter(c=>c.active).length};}
export function assertDemoPlanChange(before:DemoProgramState,next:DemoProgramState){const plan=next.assistantPlan||'intermediate',limits=licenseLimits[plan],old=demoPlanUsage(before),usage=demoPlanUsage(next),changed=plan!==(before.assistantPlan||'intermediate');for(const key of Object.keys(limits) as PlanResource[]){const cap=limits[key];if(cap!==null&&usage[key]>cap&&(changed||usage[key]>old[key]))throw new Error(`Cupo del plan alcanzado: ${resourceLabels[key]} (maximo ${cap}). Libera un lugar o cambia de plan.`);}}
