export function googleAccessRedirect(current:string,owner:boolean){
 const source=new URL(current),target=new URL('/',source.origin);
 target.searchParams.set('acceso','google');
 if(owner)target.searchParams.set('registro','jefe');
 const admin=source.searchParams.get('admin');if(admin&&['seguridad','papelera','uso'].includes(admin))target.searchParams.set('admin',admin);
 return target.href;
}
export async function googleProviderAvailable(signal:AbortSignal):Promise<boolean>{
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)return false;
 const endpoint=new URL('auth/v1/settings',url.endsWith('/')?url:`${url}/`);
 const response=await fetch(endpoint,{headers:{apikey:key},signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw new Error('No se pudo consultar Google');
 const settings=await response.json();if(typeof settings.external?.google!=='boolean')throw new Error('Configuración sin verificar');
 return settings.external.google;
}
