import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {resourceLabels,type PlanResource,type PlanLimits} from '../domain/licenseLimits';
type Usage={plan:string;name:string;limits:PlanLimits;usage:Record<PlanResource,number>};
export function OwnerPlanUsage({client,tenantId,revision=0,disabled=false}:{client:SupabaseClient;tenantId:string;revision?:number;disabled?:boolean}){
 const [show,setShow]=useState(false),[data,setData]=useState<Usage|null>(null),[error,setError]=useState(''),[pulse,setPulse]=useState(0);
 useEffect(()=>{if(!show)return;let active=true;setData(null);setError('');void(async()=>{try{const r=await client.rpc('owner_license_usage',{p_tenant:tenantId});if(r.error||!r.data?.limits||!r.data?.usage)throw r.error||new Error('Respuesta invalida');if(active)setData(r.data);}catch{if(active)setError('No pudimos verificar los cupos. Actualiza para consultarlos.');}})();return()=>{active=false;};},[client,tenantId,revision,show,pulse]);
 return <section className="owner-plan-usage"><button disabled={disabled} aria-expanded={show} onClick={()=>setShow(v=>!v)}>{show?'Ocultar cupos de mi plan':'Ver cupos de mi plan'}</button>{show&&<><h3>{data?`Plan ${data.name}`:'Cupos de la cuenta'}</h3><p>Las unidades de cada modelo son ilimitadas. Preparar un reparto ocupa planificacion; cargarlo ocupa un lugar activo hasta su cierre final.</p><button disabled={disabled} onClick={()=>setPulse(v=>v+1)}>Actualizar cupos</button>{error?<p role="alert">{error}</p>:!data?<p role="status">Consultando cupos...</p>:<dl>{(Object.keys(resourceLabels) as PlanResource[]).map(k=><div key={k}><dt>{resourceLabels[k]}</dt><dd>{data.usage[k]} / {data.limits[k]??'Ilimitado'}</dd></div>)}</dl>}</>}</section>;
}
