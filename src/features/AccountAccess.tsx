import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {googleAccessRedirect,googleProviderAvailable} from '../domain/googleAccess';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Droplets, ArrowRight, ShieldCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import './AccountRecovery.css';

export function AccountAccess({client,onSession}:{client:SupabaseClient|null;onSession:(session:Session|null)=>void}){
 type Field='name'|'company'|'email'|'password'|'confirmation';
 const [mode,setMode]=useState<'login'|'signup'|'owner-signup'|'reset'>(()=>new URLSearchParams(window.location.search).get('registro')==='jefe'?'owner-signup':'login'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [errors,setErrors]=useState<Partial<Record<Field,string>>>({}),[failed,setFailed]=useState(false),[visible,setVisible]=useState(false),[passwordLength,setPasswordLength]=useState(0),[emailHint,setEmailHint]=useState(''),[completed,setCompleted]=useState<{email:string;owner:boolean;created:boolean;pendingValidation?:boolean}|null>(null);
 const id=useId(),inFlight=useRef(false);
 const signup=mode==='signup'||mode==='owner-signup',owner=mode==='owner-signup';
 const [google,setGoogle]=useState<'checking'|'ready'|'unavailable'|'error'>('checking'),[googleRevision,setGoogleRevision]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);setGoogle('checking');void(async()=>{try{const enabled=client?await googleProviderAvailable(controller.signal):false;if(active)setGoogle(enabled?'ready':'unavailable');}catch{if(active)setGoogle('error');}finally{clearTimeout(timer);}})();return()=>{active=false;controller.abort();clearTimeout(timer);};},[client,googleRevision]);
 async function continueGoogle(){
  if(!client||busy||inFlight.current||google!=='ready')return;
  inFlight.current=true;setBusy(true);setFailed(false);setMessage('');
  try{const r=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:googleAccessRedirect(window.location.href,owner),queryParams:{prompt:'select_account'}}});if(r.error||!r.data?.url)throw new Error();}
  catch{setFailed(true);setMessage('No pudimos abrir el ingreso con Google. Volvé a intentarlo o ingresá con correo y contraseña.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!client||busy||inFlight.current)return;const form=e.currentTarget,data=new FormData(form),email=String(data.get('email')||'').trim(),password=String(data.get('password')||''),name=String(data.get('name')||'').trim();
  setMessage('');setFailed(false);setEmailHint(email);
  const company=String(data.get('company')||'').trim();
  const invalid:Partial<Record<Field,string>>={};
  if(signup&&(!name||name.length>100))invalid.name='Ingresá tu nombre, de hasta 100 caracteres.';
  if(owner&&(!company||company.length>120))invalid.company='Ingresá el nombre de tu empresa, de hasta 120 caracteres.';
  const emailInput=form.elements.namedItem('email') as HTMLInputElement;
  if(!email||email.length>254||emailInput.validity.typeMismatch)invalid.email='Ingresá un correo electrónico válido.';
  if(mode!=='reset'&&(!password||password.length>128||(signup&&password.length<12)))invalid.password=signup?`La contraseña debe tener entre 12 y 128 caracteres. Escribiste ${password.length}.`:'Ingresá tu contraseña.';
  if(signup&&password!==String(data.get('confirmation')||''))invalid.confirmation='Las contraseñas no coinciden. Revisá la repetición.';
  setErrors(invalid);
  const first=Object.keys(invalid)[0];if(first){setFailed(true);setMessage('Revisá los campos marcados para continuar.');(form.elements.namedItem(first) as HTMLInputElement)?.focus();return;}
  inFlight.current=true;setBusy(true);
  try{
   const redirect=new URL(window.location.pathname,window.location.origin);
   if(mode==='login'){
    const r=await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;form.reset();onSession(r.data.session);
   }else if(signup){
    // Metadata records intent only. The verified onboarding RPC provisions roles.
    if(owner)redirect.searchParams.set('registro','jefe');
    const r=await client.auth.signUp({email,password,options:{data:{full_name:name,...(owner?{signup_kind:'owner',company_name:company}:{})},emailRedirectTo:redirect.href}});if(r.error)throw r.error;
    if(!r.data?.user&&!r.data?.session)throw new Error('Registro sin confirmación');
    form.reset();setPasswordLength(0);setVisible(false);
    if(r.data.session)onSession(r.data.session);
    else setCompleted({email,owner,created:Boolean(r.data.user?.identities?.length)});
   }else{
    redirect.searchParams.set('auth','recovery');
    const r=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect.href});if(r.error)throw r.error;
    form.reset();setMessage('Si el correo tiene una cuenta, recibirás un enlace para cambiar tu contraseña.');
   }
  }catch(e){
   for(const name of ['password','confirmation']){const input=form.elements.namedItem(name) as HTMLInputElement|null;if(input)input.value='';}setPasswordLength(0);setVisible(false);setFailed(true);
   const code=(e as {code?:string}).code;
   if(mode==='login'&&code==='email_not_confirmed'){setCompleted({email,owner:false,created:false,pendingValidation:true});setFailed(false);return;}
   setMessage(mode==='login'?'No pudimos iniciar sesión. Revisá tu correo, contraseña y conexión.':code==='user_already_exists'?'Ese correo ya tiene una cuenta. Usá Ingresar a mi cuenta o recuperá tu contraseña.':code==='weak_password'?'La contraseña no cumple los requisitos del servicio. Probá una distinta y más larga.':code==='over_email_send_rate_limit'?'Se pidieron varios correos seguidos. Esperá unos minutos y revisá también Spam antes de volver a intentar.':'No pudimos confirmar la solicitud. Revisá la conexión y volvé a intentar. Conservamos tu nombre, empresa y correo.');
  }
  finally{inFlight.current=false;setBusy(false);}
 }
 async function resendValidation(){
  if(!client||!completed||inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');setFailed(false);
  try{const redirect=new URL(window.location.pathname,window.location.origin);if(completed.owner)redirect.searchParams.set('registro','jefe');const r=await client.auth.resend({type:'signup',email:completed.email,options:{emailRedirectTo:redirect.href}});if(r.error)throw r.error;setMessage('Solicitud de reenvío recibida. Revisá tu correo y Spam. Si llegan varios enlaces, usá el más reciente.');}
  catch{setFailed(true);setMessage('No pudimos confirmar el reenvío. Esperá un minuto, revisá Spam e intentá nuevamente.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 function switchMode(next:typeof mode){setMode(next);setMessage('');setErrors({});setFailed(false);setCompleted(null);setPasswordLength(0);setVisible(false);}
 function fieldError(field:Field){return errors[field]&&<small id={`${id}-${field}-error`} className="access-field-error">{errors[field]}</small>;}
 const feedback=message&&<p role={failed?'alert':'status'} className={failed?'access-feedback access-feedback-error':'access-feedback'}>{message}</p>;
 if(completed)return <section className="access-complete" aria-labelledby={`${id}-complete-title`}><CheckCircle2 size={36} aria-hidden="true"/><h2 id={`${id}-complete-title`}>{completed.pendingValidation?'Validación de correo pendiente':completed.created?'Tu cuenta fue creada':'Solicitud de registro procesada'}</h2><div className="access-validation-banner" role="status"><strong>Revisá tu correo y validá tu cuenta</strong><p>{completed.pendingValidation?'Tu correo todavía no está confirmado. Abrí el enlace de HidroTrack para poder ingresar.':completed.created?'Te enviamos automáticamente un enlace de validación. Abrilo para activar tu acceso.':'Revisá si recibiste el enlace de validación antes de continuar.'}</p></div><p>Correo ingresado: <strong>{completed.email}</strong></p>{feedback}<ol><li>Abrí el mensaje de HidroTrack y confirmá tu correo. Revisá también Spam.</li><li>{completed.owner?'Volvé a HidroTrack y completá Crear mi empresa. Ahí empieza tu prueba gratis de 30 días.':'Volvé a HidroTrack e ingresá con tu cuenta.'}</li></ol>{!completed.created&&!completed.pendingValidation&&<p>Si el correo es nuevo, recibirás el enlace de confirmación. Si ya tenías una cuenta, ingresá o recuperá tu contraseña; repetir el registro no reemplaza tu cuenta.</p>}<button className="primary wide" disabled={busy} onClick={()=>void resendValidation()}>{busy?'Solicitando reenvío…':'Reenviar correo de validación'}</button><p>Si confirmás desde otro celular o PC, usá después el botón de ingreso de abajo.</p><button className="secondary wide" disabled={busy} onClick={()=>switchMode('login')}>Ya validé · Ir a ingresar</button><button className="secondary wide" disabled={busy} onClick={()=>switchMode('reset')}>Recuperar mi contraseña</button><button className="secondary wide" disabled={busy} onClick={()=>switchMode(completed.owner?'owner-signup':'signup')}>Corregir el correo de registro</button></section>;
 return <><h2>{mode==='login'?'Bienvenido a HidroTrack':owner?'Crear mi cuenta de jefe':signup?'Crear mi cuenta de asistente':'Recuperar mi cuenta'}</h2><p className="muted">{owner?'Creá tu acceso, confirmá el correo y completá el alta de tu empresa. Podés administrar y hacer tu propio reparto.':signup?'Tu cuenta es independiente. No requiere licencia propia; compartí tu ID con los jefes para que te agreguen.':mode==='reset'?'Te enviaremos un enlace a tu correo.':'Un lugar para organizar tu jornada.'}</p>
  {feedback}
  {mode!=='reset'&&<section className="access-google" aria-label="Acceso con Google"><button type="button" className="google-signin wide" disabled={!client||busy||google!=='ready'} onClick={()=>void continueGoogle()}>Continuar con Google</button>{google==='checking'?<small>Comprobando disponibilidad de Google…</small>:google==='unavailable'?<small>El ingreso y registro con Google estará disponible cuando se termine de configurar.</small>:google==='error'?<small>No pudimos comprobar Google. Podés seguir con correo y contraseña.</small>:<small>{owner?'Con Google completás el alta de tu empresa después de ingresar.':'Sirve para ingresar o crear tu acceso. Para una cuenta nueva de jefe, elegí primero Crear cuenta de jefe.'}</small>}{google!=='ready'&&google!=='checking'&&<button type="button" disabled={busy} onClick={()=>setGoogleRevision(v=>v+1)}>Revisar disponibilidad de Google</button>}</section>}
  <form key={mode} onSubmit={submit} noValidate aria-busy={busy}>
   {signup&&<><label>Mi nombre<input name="name" required maxLength={100} autoComplete="name" disabled={busy} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name?`${id}-name-error`:undefined}/></label>{fieldError('name')}</>}
   {owner&&<><label>Nombre de mi empresa<input name="company" required maxLength={120} autoComplete="organization" disabled={busy} aria-invalid={Boolean(errors.company)} aria-describedby={errors.company?`${id}-company-error`:undefined}/></label>{fieldError('company')}</>}
   <label>Correo electrónico<input name="email" type="email" defaultValue={emailHint} maxLength={254} required autoComplete="username" disabled={busy} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email?`${id}-email-error`:undefined}/></label>{fieldError('email')}
   {mode!=='reset'&&<><label>Contraseña<input name="password" type={visible?'text':'password'} required minLength={signup?12:undefined} maxLength={128} onChange={e=>setPasswordLength(e.target.value.length)} autoComplete={mode==='login'?'current-password':'new-password'} disabled={busy} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password?`${id}-password-error`:signup?`${id}-password-help`:undefined}/></label>{signup&&<small id={`${id}-password-help`} className="access-password-help">Usá entre 12 y 128 caracteres.{passwordLength>0?` Escribiste ${passwordLength}.`:''}</small>}{fieldError('password')}</>}
   {signup&&<><label>Repetir contraseña<input name="confirmation" type={visible?'text':'password'} required maxLength={128} autoComplete="new-password" disabled={busy} aria-invalid={Boolean(errors.confirmation)} aria-describedby={errors.confirmation?`${id}-confirmation-error`:undefined}/></label>{fieldError('confirmation')}</>}
   {mode!=='reset'&&<button type="button" className="access-password-toggle" aria-pressed={visible} disabled={busy} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>} {visible?'Ocultar contraseña':'Mostrar contraseña'}{signup?'s':''}</button>}
   <button className="primary wide" disabled={!client||busy}>{busy?'Procesando…':mode==='login'?'Ingresar a mi cuenta':owner?'Crear cuenta de jefe':signup?'Crear cuenta de asistente':'Enviar enlace de recuperación'}</button>
   {!client&&<small className="muted">El acceso con cuenta todavía no está configurado.</small>}
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
