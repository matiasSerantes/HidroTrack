import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import './AccountRecovery.css';
type Status={state:'verified'|'provisional'|'expired';email?:string;deadline?:string;server_now?:string};
export function EmailVerificationGate({client,userId,children}:{client:SupabaseClient;userId:string;children:ReactNode}){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[sending,setSending]=useState(false),[retry,setRetry]=useState(0),[now,setNow]=useState(Date.now()),[expires,setExpires]=useState(0);
 const sent=useRef(false),inFlight=useRef(false);
 useEffect(()=>{let active=true;void(async()=>{try{const r=await client.rpc('email_access_status');if(r.error||!['verified','provisional','expired'].includes(r.data?.state))throw r.error??new Error();const next=r.data as Status;
  if(next.state!=='verified'&&(!next.email||!Number.isFinite(Date.parse(next.deadline||''))||!Number.isFinite(Date.parse(next.server_now||''))))throw new Error();
  if(active){setStatus(next);setError('');setExpires(next.state==='verified'?0:Date.now()+Math.max(0,Date.parse(next.deadline!)-Date.parse(next.server_now!)));}
 }catch{if(active)setError('No pudimos verificar la validación del correo. Revisá la conexión y actualizá el estado.');}})();return()=>{active=false;};},[client,userId,retry]);
 useEffect(()=>{if(status?.state==='verified')return;const refresh=()=>{if(document.visibilityState!=='hidden')setRetry(v=>v+1);};const timer=window.setInterval(refresh,30000),clock=window.setInterval(()=>setNow(Date.now()),1000);window.addEventListener('focus',refresh);const subscription=client.auth.onAuthStateChange(()=>setRetry(v=>v+1));return()=>{window.clearInterval(timer);window.clearInterval(clock);window.removeEventListener('focus',refresh);subscription.data.subscription.unsubscribe();};},[client,status?.state]);
 async function send(){if(inFlight.current||!status?.email)return;inFlight.current=true;setSending(true);setNotice('');
  try{const url=new URL(window.location.pathname,window.location.origin);const r=await client.auth.signInWithOtp({email:status.email,options:{shouldCreateUser:false,emailRedirectTo:url.href}});if(r.error)throw r.error;setNotice('Enlace solicitado. Revisá tu correo y Spam; al abrirlo se valida tu cuenta. Si pediste varios, usá el más reciente.');}catch{setNotice('No pudimos solicitar el enlace. Esperá un minuto y volvé a intentarlo. Tu cuenta y tus datos se conservan.');}finally{inFlight.current=false;setSending(false);}}
 useEffect(()=>{if(status?.state==='provisional'&&!sent.current){sent.current=true;void send();}},[status?.state]);
 const expired=status?.state==='expired'||(status?.state==='provisional'&&expires>0&&now>=expires);
 if(status?.state==='verified')return children;
 const help=<section className="email-verification-notice" aria-label="Validación del correo"><h2>{expired?'Validá tu correo para continuar':'Tenés 24 horas para validar tu correo'}</h2><p>{status?.email}</p><p>{expired?'El acceso está bloqueado temporalmente. Abrí el enlace que te enviamos para continuar con tu misma cuenta, empresa y datos.':'Podés usar HidroTrack ahora. Abrí el enlace enviado a tu correo antes de que venza el plazo para seguir sin interrupciones.'}</p>{status?.state==='provisional'&&!expired&&<p>Tiempo restante: {Math.max(0,Math.ceil((expires-now)/60000))} minutos.</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<div className="access-options"><button className="primary" disabled={sending||!status} onClick={()=>void send()}>{sending?'Solicitando enlace…':'Enviar enlace de validación'}</button><button onClick={()=>setRetry(v=>v+1)}>Ya validé · Actualizar estado</button><button onClick={()=>void client.auth.signOut()}>Cerrar sesión</button></div></section>;
 if(!status||expired)return <div className="account-recovery"><main className="recovery-card">{!status&&!error?<p role="status">Verificando tu correo…</p>:help}</main></div>;
 return <>{help}{children}</>;
}
