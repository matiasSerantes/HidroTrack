import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './DemoProgram.css';
import './DemoPalette.css';
import './AssistantWorkspace.css';
import { AssistantChiefs } from './AssistantChiefs';
import { AssistantTripInvitations } from './TripInvitations';

export function AssistantWorkspace({client,userId}:{client:SupabaseClient;userId:string}){
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0);
  const [showPassword,setShowPassword]=useState(false),[verified,setVerified]=useState(false);
  useEffect(()=>{let active=true;setLoading(true);setVerified(false);setShowPassword(false);setError('');void (async()=>{
    try{
      const [profile,identity]=await Promise.all([client.from('user_profiles').select('user_id,full_name').eq('user_id',userId).single(),client.auth.getUser()]);
      if(profile.error||profile.data?.user_id!==userId||identity.error||identity.data.user?.id!==userId)throw new Error('No pudimos verificar tu perfil personal. Volvé a ingresar o intentá actualizar.');
      if(active){setVerified(true);setName(profile.data.full_name||'');setEmail(identity.data.user.email||'');}
    }catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo cargar tu perfil.');}
    finally{if(active)setLoading(false);}
  })();return()=>{active=false;};},[client,userId,retry]);
  async function saveName(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||loading||!verified)return;const value=name.trim();if(!value||value.length>100){setError('Completá tu nombre, hasta 100 caracteres.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const result=await client.from('user_profiles').update({full_name:value}).eq('user_id',userId).select('user_id,full_name').single();
      if(result.error||result.data?.user_id!==userId)throw new Error('No se pudo confirmar el nombre. Actualizá tu perfil antes de volver a guardarlo.');
      setName(result.data.full_name);setNotice('Tu nombre quedó guardado en tu cuenta.');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar el nombre.');}finally{setBusy(false);}
  }
  async function changePassword(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||loading||!verified)return;const form=e.currentTarget,data=new FormData(form),password=String(data.get('password')||''),confirmation=String(data.get('confirmation')||'');
    setError('');setNotice('');if(password.length<12||password.length>128){setError('Usá entre 12 y 128 caracteres.');return;}if(password!==confirmation){setError('Las contraseñas no coinciden.');return;}
    setBusy(true);
    try{
      const result=await client.auth.updateUser({password});
      if(result.error){
        if(['reauthentication_needed','reauthentication_not_valid'].includes(result.error.code||''))throw new Error('Supabase requiere verificar tu sesión. Volvé a ingresar y luego cambiá la contraseña.');
        throw new Error('No se pudo confirmar el cambio. Volvé a ingresar antes de intentarlo otra vez.');
      }
      if(result.data.user?.id!==userId)throw new Error('No se pudo confirmar el cambio para esta cuenta. Volvé a ingresar.');
      form.reset();setShowPassword(false);setNotice('Contraseña actualizada en tu cuenta. Usá la nueva en el próximo ingreso.');
    }catch(e){form.reset();setError(e instanceof Error?e.message:'No se recibió confirmación del cambio.');}finally{setBusy(false);}
  }
  async function signOut(){if(busy)return;setBusy(true);setError('');try{const result=await client.auth.signOut();if(result.error)throw result.error;}catch{setError('No se pudo cerrar sesión. Intentá nuevamente.');setBusy(false);}}
  return <div className="hd assistant-real"><main><header><span className="hd-tag mint">MI CUENTA · ACCESO REAL</span><button className="hd-btn" disabled={busy} onClick={()=>void signOut()}>Cerrar sesión</button></header><section className="assistant-wait-card"><h1>Tu espacio de asistente</h1><p>Tu cuenta es independiente de los jefes. Acá administrás tus datos personales.</p><div className="assistant-wait-status"><h2>Cuenta independiente</h2><p>Revisá tus invitaciones. Solo al aceptar podrás abrir el resumen del recorrido asignado.</p></div></section>
    {error&&<p className="assistant-real-error" role="alert">{error}</p>}{notice&&<p className="assistant-real-notice" role="status">{notice}</p>}
    {verified&&<AssistantTripInvitations key={`trips-${userId}`} client={client}/>}
    <button className="hd-btn primary" disabled={busy||loading} onClick={()=>setRetry(v=>v+1)}>Actualizar mi perfil</button>
    {loading?<p role="status">Cargando tu perfil…</p>:<section className="assistant-profile-card"><h2>Mi perfil</h2><p>Correo: {email||'No disponible'}</p><form onSubmit={saveName}><label>Mi nombre<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100} disabled={busy||!verified}/></label><button className="hd-btn primary" disabled={busy||!verified}>Guardar mi nombre</button></form>
      <section className="assistant-profile-pending"><label>Mi ID para compartir<input readOnly value={`HT-${userId.toUpperCase()}`} onFocus={e=>e.currentTarget.select()}/></label><button className="hd-btn primary" disabled={busy||!verified} onClick={()=>{const id=`HT-${userId.toUpperCase()}`;if(!navigator.clipboard){setNotice('Seleccioná y copiá tu ID manualmente.');return;}void navigator.clipboard.writeText(id).then(()=>setNotice('ID personal copiado.'),()=>setNotice('Seleccioná y copiá tu ID manualmente.'));}}>Copiar mi ID</button><p>Tu ID identifica tu cuenta; no es una contraseña. Compartilo para que el jefe te agregue a su lista de asistentes. Tu identidad se conserva al cambiar de jefe.</p><h3>Foto de perfil</h3><p>Pendiente de conectar el almacenamiento privado de fotos.</p></section>
      <button className="hd-btn primary" disabled={busy||!verified} aria-expanded={showPassword} onClick={()=>{setShowPassword(!showPassword);setError('');setNotice('');}}>Cambiar mi contraseña</button>
      {showPassword&&<form key={userId} onSubmit={changePassword}><p>Este cambio es real y afecta solo tu cuenta. No uses las claves de otro usuario.</p><label>Nueva contraseña<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy}/></label><label>Repetir nueva contraseña<input type="password" name="confirmation" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy}/></label><button className="hd-btn primary" disabled={busy}>Confirmar cambio de contraseña</button><button className="hd-btn" type="button" disabled={busy} onClick={()=>setShowPassword(false)}>Cancelar</button></form>}
    </section>}
    {verified&&<AssistantChiefs key={userId} client={client}/>}
  </main></div>;
}
