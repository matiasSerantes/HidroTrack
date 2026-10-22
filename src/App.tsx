import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Droplets, Truck, ArrowUpRight } from 'lucide-react';
import { AccountAccess, AccountRecovery } from './features/AccountAccess';
import { supabase } from './lib/supabase';
const AccountWorkspace=lazy(()=>import('./features/AccountWorkspace').then(m=>({default:m.AccountWorkspace})));
const LegacyApp=lazy(()=>import('./features/LegacyApp').then(m=>({default:m.LegacyApp})));
const DemoProgram=lazy(()=>import('./features/DemoProgram').then(m=>({default:m.DemoProgram})));
const AdminWorkspace=lazy(()=>import('./features/AdminWorkspace').then(m=>({default:m.AdminWorkspace})));

export function App() {
  if (new URLSearchParams(window.location.search).get('demo') === 'admin') return <Suspense fallback={<main><p role="status">Abriendo administración de ejemplo…</p></main>}><AdminWorkspace demo onExit={() => { const url = new URL(window.location.href); url.searchParams.delete('demo'); window.location.assign(url.pathname + url.search + url.hash); }}/></Suspense>;
  if (new URLSearchParams(window.location.search).get('demo') === 'legacy') return <Suspense fallback={<main><p role="status">Abriendo demostración anterior…</p></main>}><LegacyApp/></Suspense>;
  return <MainApp/>;
}
function MainApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [recovering,setRecovering]=useState(()=>new URLSearchParams(window.location.search).get('auth')==='recovery');
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    const subscription = supabase.auth.onAuthStateChange((event, value) => {
      if(active&&event==='PASSWORD_RECOVERY')setRecovering(true);
      receivedAuthEvent = true;
      if (active) { setSession(value); setCheckingSession(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) { if (!error && !receivedAuthEvent) setSession(data.session); setCheckingSession(false); }
    }).catch(() => { if (active) setCheckingSession(false); });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, []);
  const [demo, setDemo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');
  function exitDemo() {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    setDemo(false);
  }
  if (demo) return <Suspense fallback={<main><p role="status">Abriendo la demostración…</p></main>}><DemoProgram onExit={exitDemo} /></Suspense>;
  if (checkingSession) return <main><p role="status">Recuperando tu sesión…</p></main>;
  if(session&&supabase&&recovering)return <AccountRecovery client={supabase} onDone={()=>{const url=new URL(window.location.href);url.searchParams.delete('auth');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setRecovering(false);}}/>;
  if (session && supabase) return <Suspense fallback={<main><p role="status">Abriendo tu reparto…</p></main>}><AccountWorkspace key={session.user.id} client={supabase} userId={session.user.id}/></Suspense>;
  return <div className="login"><section className="login-story"><Brand /><div><span className="eyebrow">CADA DÍA, TODO EN ORDEN</span><h1>Tu reparto.<br />Bajo control.</h1><p>Clientes, entregas y cuentas claras.<br />Más tiempo para hacer crecer tu recorrido.</p><div className="story-icons"><Truck size={38}/><span>De la primera entrega<br />al cierre del día.</span></div></div><small>Hecho para repartidores independientes.</small></section><section className="login-form"><span className="badge">PRIMERA VERSIÓN</span><AccountAccess client={supabase} onSession={setSession}/><div className="divider">CONOCÉ LA APLICACIÓN</div><button className="secondary wide" onClick={() => setDemo(true)}>Explorar demostración <ArrowUpRight size={18}/></button><small className="muted">Datos ficticios guardados en este navegador.</small></section></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon"><Droplets size={25}/></span><span>HidroTrack<small>GESTIÓN DE REPARTOS</small></span></div>; }
