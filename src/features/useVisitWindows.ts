import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export function useVisitWindows(client:SupabaseClient,tenantId:string,enabled:boolean){
 const [windows,setWindows]=useState<Record<string,{start_time:string;end_time:string}>|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{if(!enabled)return;let active=true;setWindows(null);setFailed(false);void(async()=>{try{const result:Record<string,{start_time:string;end_time:string}>={};for(let offset=0;;offset+=500){const r=await client.from('customer_visit_windows').select('customer_id,start_time,end_time').eq('tenant_id',tenantId).order('customer_id').range(offset,offset+499);if(r.error||!Array.isArray(r.data))throw new Error();for(const w of r.data)result[w.customer_id]={start_time:w.start_time.slice(0,5),end_time:w.end_time.slice(0,5)};if(r.data.length<500)break;}if(active)setWindows(result);}catch{if(active)setFailed(true);}})();return()=>{active=false;};},[client,tenantId,enabled]);return {windows,failed};
}
