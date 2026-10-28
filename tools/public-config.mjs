// Build-time guard only. Public keys still rely on server-side RLS and RPC guards.
/** @param {Record<string,string|undefined>} env */
export function assertPublicSupabaseConfig(env){
 const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY;
 if(!url&&!key)return; // A build without account configuration can still show the demo.
 const fail=()=>{throw new Error('Configuración pública de Supabase inválida. Usá URL y clave publishable/anon; nunca una clave secret o service_role.');};
 if(!url||!key||key!==key.trim())return fail();
 try{const u=new URL(url);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))return fail();}catch{return fail();}
 if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return;
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))return fail();
 try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')return fail();}catch{return fail();}
}
