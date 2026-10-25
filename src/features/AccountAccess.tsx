import { useState, type FormEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Droplets, ArrowRight, ShieldCheck } from 'lucide-react';
import './AccountRecovery.css';

export function AccountAccess({client,onSession}:{client:SupabaseClient|null;onSession:(session:Session|null)=>void}){
 const [mode,setMode]=useState<'login'|'signup'|'owner-signup'|'reset'>(()=>new URLSearchParams(window.location.search).get('registro')==='jefe'?'owner-signup':'login'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const signup=mode==='signup'||mode==='owner-signup',owner=mode==='owner-signup';
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!client||busy)return;const form=e.currentTarget,data=new FormData(form),email=String(data.get('email')||'').trim(),password=String(data.get('password')||''),name=String(data.get('name')||'').trim();
  setMessage('');
  const company=String(data.get('company')||'').trim();
  if(signup&&(!name||name.length>100||password.length<12||password.length>128||password!==data.get('confirmation')||(owner&&(!company||company.length>120)))){setMessage('Completá nombre, empresa si corresponde y dos contraseñas iguales de 12 a 128 caracteres.');return;}
  setBusy(true);
  try{
   const redirect=new URL(window.location.pathname,window.location.origin);
   if(mode==='login'){
    const r=await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;form.reset();onSession(r.data.session);
   }else if(signup){
    // Metadata records intent only. The verified onboarding RPC provisions roles.
    if(owner)redirect.searchParams.set('registro','jefe');
    const r=await client.auth.signUp({email,password,options:{data:{full_name:name,...(owner?{signup_kind:'owner',company_name:company}:{})},emailRedirectTo:redirect.href}});if(r.error)throw r.error;
    form.reset();if(r.data.session)onSession(r.data.session);
    setMessage('Revisá tu correo para confirmar la cuenta. Si ya tenías una cuenta, ingresá o recuperá tu contraseña.');
   }else{
    redirect.searchParams.set('auth','recovery');
    const r=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect.href});if(r.error)throw r.error;
    form.reset();setMessage('Si el correo tiene una cuenta, recibirás un enlace para cambiar tu contraseña.');
   }
  }catch{form.reset();setMessage(mode==='login'?'No pudimos iniciar sesión. Revisá tus datos y la conexión.':'No pudimos completar la solicitud. Revisá la conexión o intentá más tarde.');}
  finally{setBusy(false);}
 }
 function switchMode(next:typeof mode){setMode(next);setMessage('');}
 return <><h2>{mode==='login'?'Bienvenido a HidroTrack':owner?'Crear mi cuenta de jefe':signup?'Crear mi cuenta de asistente':'Recuperar mi cuenta'}</h2><p className="muted">{owner?'Creá tu acceso, confirmá el correo y completá el alta de tu empresa. Podés administrar y hacer tu propio reparto.':signup?'Tu cuenta es independiente. No requiere licencia propia; compartí tu ID con los jefes para que te agreguen.':mode==='reset'?'Te enviaremos un enlace a tu correo.':'Un lugar para organizar tu jornada.'}</p>
  <form key={mode} onSubmit={submit}>
   {signup&&<label>Mi nombre<input name="name" required maxLength={100} autoComplete="name" disabled={busy}/></label>}
   {owner&&<label>Nombre de mi empresa<input name="company" required maxLength={120} autoComplete="organization" disabled={busy}/></label>}
   <label>Correo electrónico<input name="email" type="email" maxLength={254} required autoComplete="username" disabled={busy}/></label>
   {mode!=='reset'&&<label>Contraseña<input name="password" type="password" required minLength={signup?12:undefined} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} disabled={busy}/></label>}
   {signup&&<label>Repetir contraseña<input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy}/></label>}
   <button className="primary wide" disabled={!client||busy}>{busy?'Procesando…':mode==='login'?'Ingresar a mi cuenta':owner?'Crear cuenta de jefe':signup?'Crear cuenta de asistente':'Enviar enlace de recuperación'}</button>
   {!client&&<small className="muted">El acceso con cuenta todavía no está configurado.</small>}
   {message&&<p role="status">{message}</p>}
  </form>
  <div className="access-options">{mode==='login'&&<button className="secondary wide" disabled={busy} onClick={()=>switchMode('owner-signup')}>Crear cuenta de jefe</button>}<button className="secondary wide" disabled={busy} onClick={()=>switchMode(mode==='login'?'signup':'login')}>{mode==='login'?'Crear cuenta de asistente':'Volver al ingreso'}</button>{mode==='login'&&<button className="secondary wide" disabled={busy} onClick={()=>switchMode('reset')}>Olvidé mi contraseña</button>}</div>
 </>;
}

export function AccountRecovery({client,onDone}:{client:SupabaseClient;onDone:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const form=e.currentTarget,data=new FormData(form),password=String(data.get('password')||'');
  if(password.length<12||password.length>128||password!==data.get('confirmation')){setMessage('Usá dos contraseñas iguales de 12 a 128 caracteres.');return;}
  setBusy(true);setMessage('');
  try{
   const identity=await client.auth.getUser();if(identity.error||!identity.data.user)throw new Error();
   const r=await client.auth.updateUser({password});if(r.error||r.data.user?.id!==identity.data.user.id)throw new Error();
   form.reset();onDone();
  }catch{form.reset();setMessage('No pudimos confirmar el cambio. Si el enlace venció, solicitá otro desde el ingreso.');}
  finally{setBusy(false);}
 }
 return <div className="account-recovery"><main className="recovery-card"><div className="recovery-brand"><span aria-hidden="true"><Droplets size={30}/></span><div>HidroTrack<small>Tu reparto, en buenas manos.</small></div></div><div className="recovery-kicker"><ShieldCheck size={16} aria-hidden="true"/> Recuperá tu acceso</div><h1>Elegí tu nueva contraseña</h1><p className="recovery-intro">Guardala y te llevamos directamente a tu cuenta.</p><form onSubmit={submit} aria-busy={busy}><label>Nueva contraseña<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="recovery-password-help" disabled={busy}/></label><small id="recovery-password-help">Usá entre 12 y 128 caracteres.</small><label>Repetir contraseña<input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy}/></label>{message&&<p role="alert" className="recovery-error">{message}</p>}<button className="recovery-submit" disabled={busy}>{busy?'Guardando tu contraseña…':'Guardar y entrar a mi cuenta'}<ArrowRight size={18} aria-hidden="true"/></button>{busy&&<p role="status" className="recovery-help">Confirmando el cambio…</p>}</form></main></div>;
}
