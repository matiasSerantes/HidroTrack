export type PlanningPoint={id:string;name:string;address?:string;latitude?:number|null;longitude?:number|null};
export function hasPlanningPoint(p:PlanningPoint){return p.latitude!=null&&p.longitude!=null&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
