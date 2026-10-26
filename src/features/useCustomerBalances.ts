import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export function useCustomerBalances(client:SupabaseClient,tenantId:string,enabled:boolean){
 const [balances,setBalances]=useState<Record<string,number>|null>(null),[failed,setFailed]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{if(!enabled)return;const refresh=()=>{if(document.visibilityState!=='hidden')setVersion(v=>v+1);};const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[enabled]);
 useEffect(()=>{let active=true;setBalances(null);setFailed(false);if(!enabled||!tenantId)return;void(async()=>{try{const sums:Record<string,number>={};for(let offset=0;;offset+=500){const r=await client.from('customer_sale_balances').select('id,customer_id,balance').eq('tenant_id',tenantId).order('id').range(offset,offset+499);if(r.error||!Array.isArray(r.data))throw new Error();for(const row of r.data){if(typeof row.customer_id!=='string'||!Number.isFinite(Number(row.balance)))throw new Error();sums[row.customer_id]=(sums[row.customer_id]||0)+Math.round(Number(row.balance)*100);}if(r.data.length<500)break;}if(active)setBalances(sums);}catch{if(active)setFailed(true);}})();return()=>{active=false;};},[client,tenantId,enabled,version]);
 return {balances,failed,refreshBalances:()=>setVersion(v=>v+1)};
}
