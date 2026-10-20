import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Building2, ChevronRight, Droplets, LayoutDashboard, LogOut, Menu, Package, Route, Truck, Users, X } from 'lucide-react';
import './DemoProgram.css';
import './DemoPalette.css';
import './OwnerWorkspace.css';

export type OwnerView = 'overview' | 'customers' | 'stock' | 'catalog' | 'trips' | 'dispensers';
const navigation = [
  ['overview', 'Mi jornada', LayoutDashboard], ['customers', 'Clientes', Users],
  ['catalog', 'Catálogo', Package], ['stock', 'Stock', Truck],
  ['trips', 'Repartos y camión', Route],
] as const;
export const ownerViewTitle = (view: OwnerView) => view==='dispensers'?'Catálogo':navigation.find(([id]) => id === view)![1];

export function OwnerShell({ children, view, go, company, owner, locked, ready, signOut }: {
  children: ReactNode; view: OwnerView; go: (view: OwnerView) => void; company?: string; owner?: string;
  locked: boolean; ready: boolean; signOut: () => void;
}) {
  const [mobile,setMobile]=useState(false), menu=useRef<HTMLButtonElement>(null);
  const initials=(company||'HidroTrack').split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  function closeMenu() {setMobile(false);menu.current?.focus();}
  function navigate(next: OwnerView) {if(locked||!ready)return;go(next);setMobile(false);}
  useEffect(()=>{
    if(!mobile)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMobile(false);menu.current?.focus();}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[mobile]);
  return <div className="hd hd-shell owner-real">
    {mobile&&<button className="owner-drawer-scrim" aria-label="Cerrar navegación" onClick={closeMenu}/>}
    <aside className={`hd-sidebar ${mobile?'show':''}`} id="owner-sidebar"><button className="hd-brand owner-brand" disabled={!ready||locked} onClick={()=>navigate('overview')}><span><Droplets size={25}/></span>HidroTrack<span className="hd-brand-dot">.</span></button>
      <div className="hd-workspace"><span className="hd-avatar teal">{initials}</span><div><strong>{company||'Tu reparto'}</strong><small>Cuenta de jefe</small></div></div>
      <span className="hd-nav-label">TU ESPACIO DE TRABAJO</span><nav aria-label="Secciones del jefe">{navigation.map(([id,label,Icon])=><button disabled={!ready||locked} key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="hd-sidebar-bottom"><div className="hd-preview-note"><Building2 size={18}/><div><strong>Tu empresa, tus datos</strong><small>{owner||'Cuenta conectada'}</small></div></div><button className="hd-exit" disabled={locked} onClick={signOut}><LogOut size={17}/> Cerrar sesión</button></div>
    </aside>
    <div className="hd-body"><header className="hd-topbar"><div className="hd-top-left"><button ref={menu} className="hd-icon hd-mobile-menu" aria-label="Abrir navegación" aria-expanded={mobile} aria-controls="owner-sidebar" disabled={locked} onClick={()=>setMobile(!mobile)}>{mobile?<X size={21}/>:<Menu size={21}/>}</button><span className="hd-breadcrumb">Mi espacio <ChevronRight size={13}/><strong>{ownerViewTitle(view)}</strong></span></div><div className="hd-top-actions"><span className="hd-tag mint"><span className="hd-dot"/> CUENTA REAL</span><div className="hd-company-logo"><span className="hd-avatar teal">{initials}</span><div><strong>{company||'HidroTrack'}</strong><small>Repartidor jefe</small></div></div></div></header>
      <main className="hd-main connected-workspace">{children}<footer className="hd-footer"><span><Droplets size={14}/> HidroTrack · Tu reparto, en buenas manos.</span></footer></main>
    </div>
    <nav className="hd-touch-nav" aria-label="Navegación rápida móvil">{([
      ['overview','Hoy','Ver mi jornada',LayoutDashboard], ['customers','Clientes','Ver clientes',Users], ['catalog','Catálogo','Ver catálogo',Package], ['trips','Repartos','Ver repartos',Route],
    ] as const).map(([id,label,accessible,Icon])=><button key={id} aria-label={accessible} disabled={!ready||locked} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={21}/><span>{label}</span></button>)}</nav>
  </div>;
}

export function OwnerOverview({ company, customers, go, addCustomer }: {company:string;customers:{id:string;name:string;address:string}[];go:(view:OwnerView)=>void;addCustomer:()=>void}) {
  return <><div className="hd-metrics owner-home-metrics"><article className="hd-metric emphasis"><div><span>Clientes activos</span><Users size={19}/></div><strong>{customers.length}</strong><small>Registrados en tu empresa</small></article><article className="hd-metric"><div><span>Tu empresa</span><Building2 size={19}/></div><strong className="owner-company-name">{company}</strong><small>Tu espacio de trabajo</small></article></div>
    <div className="hd-dashboard"><div><section className="hd-day-banner"><div><span className="hd-tag glass">TODO EN UN MISMO LUGAR</span><h2>Tu reparto.<br/>Bajo control.</h2><p>Controlá tus envases, ubicá los dispenser y prepará el camión para salir.</p><button className="hd-btn white" onClick={()=>go('stock')}>Abrir mi inventario <ChevronRight size={17}/></button></div><div className="hd-banner-art" aria-hidden="true"><span className="hd-art-ring r1"/><span className="hd-art-ring r2"/><Truck size={94} strokeWidth={1.2}/></div></section>
    <section className="hd-card owner-home-panel"><div className="hd-section"><div><h2>Tus clientes</h2><p>Últimos datos de tu empresa</p></div><button className="hd-btn small" onClick={()=>go('customers')}>Ver clientes <ChevronRight size={15}/></button></div>{customers.length?customers.slice(0,5).map(c=><div className="hd-list-row" key={c.id}><span className="hd-avatar teal">{c.name.slice(0,1).toUpperCase()}</span><div><strong>{c.name}</strong><small>{c.address}</small></div></div>):<p className="hd-help">Todavía no hay clientes. Agregá el primero para registrar los envases y equipos que tiene.</p>}<button className="hd-btn primary" onClick={addCustomer}>Nuevo cliente</button></section></div>
    <section className="hd-card owner-home-panel"><div className="hd-section"><h2>¿Por dónde empezamos?</h2></div><div className="hd-quick-grid">{([
      ['catalog','Catálogo','Productos, dispenser e inventario',Package],['stock','Inventario','Llenos, vacíos y envases en clientes',Truck],['trips','Repartos','Preparación, carga y regreso',Route],
    ] as const).map(([id,label,description,Icon])=><button key={id} onClick={()=>go(id)}><span><Icon size={21}/></span><div><strong>{label}</strong><small>{description}</small></div><ChevronRight size={16}/></button>)}</div></section></div></>;
}
