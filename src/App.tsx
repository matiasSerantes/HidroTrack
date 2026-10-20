import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Droplets, Truck, ArrowUpRight } from 'lucide-react';
import { readJourney } from './domain/demoJourney';
import { readProgram } from './domain/programDemo';
import { supabase } from './lib/supabase';
const AccountWorkspace=lazy(()=>import('./features/AccountWorkspace').then(m=>({default:m.AccountWorkspace})));
const LegacyApp=lazy(()=>import('./features/LegacyApp').then(m=>({default:m.LegacyApp})));
const DemoProgram=lazy(()=>import('./features/DemoProgram').then(m=>({default:m.DemoProgram})));

export function App() {
  if (new URLSearchParams(window.location.search).get('demo') === 'legacy') return <Suspense fallback={<main><p role="status">Abriendo demostración anterior…</p></main>}><LegacyApp/></Suspense>;
  return <MainApp/>;
}
function MainApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    const subscription = supabase.auth.onAuthStateChange((_event, value) => {
      receivedAuthEvent = true;
      if (active) { setSession(value); setCheckingSession(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) { if (!error && !receivedAuthEvent) setSession(data.session); setCheckingSession(false); }
    }).catch(() => { if (active) setCheckingSession(false); });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, []);
  const [demo, setDemo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1' || Boolean(readJourney(readProgram())));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setMessage('');
    try { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; setSession(data.session); }
    catch { setMessage('No pudimos iniciar sesión. Revisá tus datos y la conexión.'); } finally { setBusy(false); }
  }
  if (demo) return <Suspense fallback={<main><p role="status">Abriendo la demostración…</p></main>}><DemoProgram onExit={() => setDemo(false)} /></Suspense>;
  if (checkingSession) return <main><p role="status">Recuperando tu sesión…</p></main>;
  if (session && supabase) return <Suspense fallback={<main><p role="status">Abriendo tu reparto…</p></main>}><AccountWorkspace key={session.user.id} client={supabase} userId={session.user.id}/></Suspense>;
  return <div className="login"><section className="login-story"><Brand /><div><span className="eyebrow">CADA DÍA, TODO EN ORDEN</span><h1>Tu reparto.<br />Bajo control.</h1><p>Clientes, entregas y cuentas claras.<br />Más tiempo para hacer crecer tu recorrido.</p><div className="story-icons"><Truck size={38}/><span>De la primera entrega<br />al cierre del día.</span></div></div><small>Hecho para repartidores independientes.</small></section><section className="login-form"><span className="badge">PRIMERA VERSIÓN</span><h2>Bienvenido a HidroTrack</h2><p className="muted">Un lugar para organizar tu jornada.</p><form onSubmit={login}><label>Correo electrónico<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@ejemplo.com"/></label><label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label><button className="primary wide" disabled={!supabase || busy}>{busy ? 'Ingresando…' : 'Ingresar a mi cuenta'} <ArrowUpRight size={18}/></button>{!supabase && <small className="muted">El acceso con cuenta todavía no está configurado.</small>}{message && <p role="alert">{message}</p>}</form><div className="divider">CONOCÉ LA APLICACIÓN</div><button className="secondary wide" onClick={() => setDemo(true)}>Explorar demostración <ArrowUpRight size={18}/></button><small className="muted">Datos ficticios guardados en este navegador.</small></section></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon"><Droplets size={25}/></span><span>HidroTrack<small>GESTIÓN DE REPARTOS</small></span></div>; }
