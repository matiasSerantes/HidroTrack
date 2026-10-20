import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Droplets, LogIn } from 'lucide-react';
export type DemoRole = 'admin' | 'owner' | 'driver';
const accounts = { admin: 'admin@example.com', owner: 'titular.norte@example.com', driver: 'chofer.norte@example.com' };
export function DemoAccess({ onLogin, onExit }: { onLogin: (role: DemoRole) => void; onExit: () => void }) {
 const [role, setRole] = useState<DemoRole>('owner');
 const [email, setEmail] = useState(accounts.owner);
 const [password, setPassword] = useState('HidroDemo123!');
 const [recovery, setRecovery] = useState(false);
 const [notice, setNotice] = useState('');
 function submit(event: FormEvent) {
  event.preventDefault();
  if (recovery) { setNotice('Solicitud simulada: acá confirmaríamos el envío del correo de recuperación. No se envió ningún mensaje.'); return; }
  if (email.trim().toLowerCase() !== accounts[role] || password !== 'HidroDemo123!') { setNotice('Usá el correo de ejemplo del perfil elegido y la contraseña HidroDemo123!'); return; }
  onLogin(role);
 }
 return <div className="login"><section className="login-story"><div className="brand"><span className="brand-icon"><Droplets/></span>HidroTrack</div><div><span className="eyebrow">TU REPARTO, EN UN SOLO LUGAR</span><h1>Tus clientes.<br/>Tu recorrido.</h1><p>Conocé a cada cliente: dónde vive, qué pide, cuánto debe y cuándo visitarlo.</p><div className="story-icons"><LogIn size={38}/><span>Sos el dueño y quien reparte.<br/>La app te acompaña en cada visita.</span></div></div><small>Vista previa del sistema de acceso.</small></section><section className="login-form"><span className="badge">MODO DEMOSTRACIÓN</span><h2>{recovery ? 'Recuperar contraseña' : 'Ingresá a la demostración'}</h2><p className="muted">No necesitás una cuenta real. Usá los datos de ejemplo que ya están completados.</p>
 {!recovery && <label>Perfil de demostración<select value={role} onChange={e => { const next = e.target.value as DemoRole; setRole(next); setEmail(accounts[next]); setPassword('HidroDemo123!'); setNotice(''); }}><option value="owner">Mi reparto · Dueño y repartidor</option><option value="admin">Administración del sistema (vista secundaria)</option></select></label>}
 <form onSubmit={submit}><label>Correo electrónico<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off"/></label>{!recovery && <label>Contraseña<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"/></label>}<button className="primary wide">{recovery ? 'Simular recuperación' : 'Ingresar a la demo'}<ArrowUpRight size={18}/></button></form>
 {notice && <p className="notice" role="status">{notice}</p>}
 {!recovery && <small className="muted">Contraseña de ejemplo: <strong>HidroDemo123!</strong></small>}
 <button className="text-button wide" onClick={() => { setRecovery(v => !v); setNotice(''); }}>{recovery ? 'Volver al ingreso' : 'Olvidé mi contraseña'}</button><button className="secondary wide" onClick={onExit}>Volver al inicio</button><small className="muted">El acceso es simulado. No se consulta Supabase ni se envían correos desde esta demostración.</small></section></div>;
}
