import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OwnerWorkspace } from './OwnerWorkspace';
import { AdminWorkspace } from './AdminWorkspace';
import {OwnerSignupGate} from './OwnerSignupGate';

export function AccountWorkspace({ client, userId }: { client: SupabaseClient; userId: string }) {
 const [admin, setAdmin] = useState<boolean | null>(null);
 const [error, setError] = useState(false);
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  let active = true;
  setError(false);
  void client.rpc('is_platform_admin').then(({ data, error }) => {
   if (active) { if (error) setError(true); else setAdmin(data === true); }
  }, () => { if (active) setError(true); });
  return () => { active = false; };
 }, [client, userId, retry]);
 if (error) return <main><p role="alert">No pudimos verificar tu acceso.</p><button onClick={() => setRetry(v => v + 1)}>Reintentar</button><button onClick={() => void client.auth.signOut()}>Cerrar sesión</button></main>;
 if (admin === null) return <main><p role="status">Verificando tu acceso…</p></main>;
 return admin ? <AdminWorkspace client={client}/> : <OwnerSignupGate key={userId} client={client} userId={userId}><OwnerWorkspace client={client} userId={userId}/></OwnerSignupGate>;
}
