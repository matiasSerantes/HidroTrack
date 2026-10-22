import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function AssistantChiefs({client}:{client:SupabaseClient}){
 const [chiefs,setChiefs]=useState<{company:string;chief:string}[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setChiefs(null);setError(false);void (async()=>{
  try{const r=await client.rpc('assistant_my_chiefs');if(r.error)throw r.error;if(active)setChiefs(r.data??[]);}
  catch{if(active)setError(true);}
 })();return()=>{active=false;};},[client,retry]);
 return <section className="assistant-profile-card"><h2>Mis jefes</h2><p>Esta lista solo muestra quién te agregó. Cada jefe tiene su propia empresa; tus datos de acceso son los mismos.</p><button className="hd-btn" onClick={()=>setRetry(v=>v+1)}>Actualizar mis vínculos</button>{error?<p role="status">No se pudo consultar la lista. Intentá actualizar; puede requerir la actualización del servidor.</p>:chiefs===null?<p role="status">Consultando vínculos…</p>:chiefs.length?chiefs.map((c,i)=><div className="assistant-profile-pending" key={`${c.company}-${i}`}><strong>{c.company}</strong><p>{c.chief}</p></div>):<p>Todavía no te vinculó ningún jefe. Compartile tu ID.</p>}</section>;
}
