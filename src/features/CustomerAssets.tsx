import { useState, type FormEvent } from 'react';
import type { Customer } from '../domain/demo';
import { addAssetMovement, assetQuantity, type CustomerAsset } from '../domain/customerAssets';
const kinds = { bottle:'Bidón / envase', base:'Base para bidón', dispenser:'Dispenser', other:'Otro equipo' };
export function CustomerAssets({ customer, canManage, onSave }: { customer: Customer; canManage: boolean; onSave: (assets: CustomerAsset[])=>boolean }) {
 const [adding,setAdding]=useState(false);
 const [moving,setMoving]=useState<string|null>(null);
 const [error,setError]=useState('');
 const assets=customer.assets ?? [];
 function add(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if(!canManage)return;
  const f=new FormData(event.currentTarget), quantity=Number(f.get('quantity'));
  const name=String(f.get('name')??'').trim(),kind=String(f.get('kind')) as CustomerAsset['kind'],owner=f.get('owner')==='customer'?'customer':'reparto';
  if(!name || !(kind in kinds) || !Number.isSafeInteger(quantity) || quantity<0 || quantity>10000){setError('Completá la descripción y una cantidad inicial entera entre 0 y 10000.');return;}
  if(assets.some(a=>a.name.toLowerCase()===name.toLowerCase() && a.owner===owner)){setError('Ese elemento ya está registrado. Usá Entregar / retirar para cambiar su cantidad.');return;}
  const next:CustomerAsset={id:crypto.randomUUID(),name,kind,owner,openingQuantity:quantity,createdAt:new Date().toISOString(),movements:[]};
  if(onSave([...assets,next])){setAdding(false);setError('');}else setError('No se pudo guardar en este navegador.');
 }
 function move(event:FormEvent<HTMLFormElement>,asset:CustomerAsset){
  event.preventDefault();if(!canManage)return;
  const f=new FormData(event.currentTarget);
  try{const next=addAssetMovement(asset,String(f.get('direction')) as 'delivered'|'collected',Number(f.get('quantity')),String(f.get('note')??''));if(onSave(assets.map(a=>a.id===asset.id?next:a))){setMoving(null);setError('');}else setError('No se pudo guardar en este navegador.');}catch(e){setError(e instanceof Error?e.message:'Revisá los datos.');}
 }
 const movements=assets.flatMap(asset=>asset.movements.map(m=>({...m,assetName:asset.name}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <section aria-label="Envases y equipos en casa del cliente"><div className="section-heading"><div><h3>Lo que tiene en su casa</h3><p className="muted">Bidones, bases, dispensers y otros elementos, cada uno con su cantidad.</p></div>{canManage&&<button className="primary" onClick={()=>{setAdding(v=>!v);setMoving(null);setError('');}}>Agregar elemento</button>}</div>
 <p className="notice">Cargá primero lo que el cliente ya tiene. Después registrá entregas y retiros. Estos movimientos controlan elementos físicos y no generan ventas ni deudas. Los bidones llenos y vacíos se cuentan juntos.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {adding&&<form className="customer-form" onSubmit={add}><label>Descripción del elemento<input name="name" required maxLength={100} placeholder="Ej.: Bidón retornable 20 L" autoFocus/></label><label>Tipo de elemento<select name="kind">{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Propietario<select name="owner"><option value="reparto">Del reparto · prestado al cliente</option><option value="customer">Del cliente</option></select></label><label>Cantidad que ya tiene<input name="quantity" type="number" min="0" max="10000" defaultValue="0" required/></label><button className="primary">Guardar elemento</button><button type="button" onClick={()=>{setAdding(false);setError('');}}>Cancelar</button></form>}
 <div className="asset-grid">{assets.map(asset=><article className="asset-card" key={asset.id}><span className="eyebrow">{kinds[asset.kind]}</span><h3>{asset.name}</h3><strong className="asset-count">{assetQuantity(asset)} <small>en casa del cliente</small></strong><span className="pill">{asset.owner==='reparto'?'Prestado por el reparto':'Propiedad del cliente'}</span><p className="muted">Inicial: {asset.openingQuantity} · Entregados: {asset.movements.filter(m=>m.direction==='delivered').reduce((n,m)=>n+m.quantity,0)} · Retirados: {asset.movements.filter(m=>m.direction==='collected').reduce((n,m)=>n+m.quantity,0)}</p>{canManage&&<button onClick={()=>{setMoving(moving===asset.id?null:asset.id);setAdding(false);setError('');}}>Entregar / retirar {asset.name}</button>}
 {moving===asset.id&&<form onSubmit={e=>move(e,asset)}><label>Movimiento<select name="direction"><option value="delivered">Dejar en casa del cliente</option><option value="collected">Retirar de casa del cliente</option></select></label><label>Cantidad<input name="quantity" type="number" min="1" max="10000" defaultValue="1" required/></label><label>Observación del movimiento<input name="note" maxLength={300} placeholder="Ej.: segunda base para la cocina"/></label><button className="primary wide">Guardar movimiento</button></form>}</article>)}</div>
 {!assets.length&&<p className="empty">Todavía no registraste qué elementos tiene este cliente. Agregá sus bidones, bases y equipos con las cantidades actuales.</p>}
 <h3>Historial de envases y equipos</h3><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Elemento</th><th>Movimiento</th><th>Cantidad</th><th>Observación</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{new Date(m.createdAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</td><td>{m.assetName}</td><td>{m.direction==='delivered'?'Entregado':'Retirado'}</td><td>{m.quantity}</td><td>{m.note||'—'}</td></tr>)}{assets.map(a=><tr key={`opening-${a.id}`}><td>{new Date(a.createdAt).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</td><td>{a.name}</td><td>Registro inicial</td><td>{a.openingQuantity}</td><td>Ya estaba en el domicilio</td></tr>)}</tbody></table></div>
 </section>;
}
