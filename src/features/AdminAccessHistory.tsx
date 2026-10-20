import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AccessEvent = { id: string; tenant_name: string; user_email: string | null; actor_email: string | null; is_active: boolean; created_at: string };
export function AdminAccessHistory({ client, demo, events, revision }: { client?: SupabaseClient; demo: boolean; events: AccessEvent[]; revision: number }) {
 const [rows,setRows] = useState<AccessEvent[]>([]);
 const [loading,setLoading] = useState(!demo);
 const [error,setError] = useState('');
 const [retry,setRetry] = useState(0);
 useEffect(()=>{
  let active=true;
  if(demo) {setRows(events);setLoading(false);setError('');return;}
  setRows([]);setLoading(true);setError('');
  void (async()=>{
   try {
    if(!client) throw new Error('Sin conexión');
    const result=await client.rpc('admin_access_history');
    if(result.error){
     if(['PGRST202','42883'].includes(result.error.code)) {if(active)setError('El historial requiere una actualización del servidor.');return;}
     throw result.error;
    }
    if(active)setRows(result.data??[]);
   }catch{if(active)setError('No pudimos consultar el historial. Reintentá la consulta.');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[client,demo,events,revision,retry]);
 return <section className="panel" aria-label="Historial de accesos"><div className="section-heading"><h2>Historial de accesos</h2><button disabled={loading} onClick={()=>setRetry(v=>v+1)}>Actualizar historial</button></div><p className="admin-help">{demo?'Cambios ficticios realizados en esta sesión de vista previa.':'Últimos 100 cambios de acceso de choferes. Horarios de Argentina.'}</p>{loading?<p role="status">Consultando historial…</p>:error?<p role="alert">{error}</p>:rows.length?<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Empresa</th><th>Chofer</th><th>Acción</th><th>Administrador</th></tr></thead><tbody>{rows.map(event=><tr key={event.id}><td data-label="Fecha">{new Date(event.created_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</td><td data-label="Empresa">{event.tenant_name}</td><td data-label="Chofer">{event.user_email||'Correo no disponible'}</td><td data-label="Acción">{event.is_active?'Acceso reactivado':'Acceso pausado'}</td><td data-label="Administrador">{event.actor_email||'Correo no disponible'}</td></tr>)}</tbody></table></div>:<p className="empty">Todavía no hay cambios de acceso registrados.</p>}</section>;
}
