import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMoney, currency } from '../domain/demo';

type Customer = {id:string;name:string;address:string;phone:string};
type Product = {id:string;name:string;active:boolean;returnable:boolean};
type Asset = {id:string;name:string;serial:string;ownership:string;location:string;customer_id:string|null;mode:string|null;monthly:number};
type Snapshot = {products:Product[];held:{product_id:string;quantity:number}[];assets:Asset[];operations:{id:string;kind:string;created_at:string;note:string;items:{product_id:string;quantity:number}[]}[]};
type Command = {name:string;args:Record<string,unknown>;message:string};

export function OwnerCustomerSheet({client,tenantId,customer,onClose,onEdit,onLock}:{client:SupabaseClient;tenantId:string;customer:Customer;onClose:()=>void;onEdit:()=>void;onLock:(value:boolean)=>void}) {
  const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
  const [showOpening,setShowOpening]=useState(false),[showAsset,setShowAsset]=useState(false),[mode,setMode]=useState('loan');
  useEffect(()=>{onLock(busy||!!pending);return()=>onLock(false);},[busy,pending,onLock]);
  async function load():Promise<Snapshot>{
    const results=await Promise.all([
      client.from('products').select('id,name,active,returnable').eq('tenant_id',tenantId).order('name'),
      client.from('inventory_customer_containers').select('product_id,quantity').eq('tenant_id',tenantId).eq('customer_id',customer.id),
      client.from('dispensers').select('id,name,serial,ownership,location,customer_id,mode,monthly').eq('tenant_id',tenantId).order('name'),
      client.from('inventory_operations').select('id,kind,created_at,note,items').eq('tenant_id',tenantId).eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(30),
    ]);
    if(results.some(r=>r.error))throw new Error('No pudimos cargar la ficha. Revisá la conexión e intentá nuevamente.');
    return {products:results[0].data||[],held:results[1].data||[],assets:results[2].data||[],operations:results[3].data||[]} as Snapshot;
  }
  useEffect(()=>{let active=true;void load().then(d=>{if(active){setData(d);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[client,tenantId,customer.id,version]);
  async function execute(command:Command){
    if(busy)return;setBusy(true);setPending(command);setError('');setNotice('');
    try{
      const result=await client.rpc(command.name,command.args);
      if(result.error){if(result.error.code)setPending(null);throw result.error;}
      setPending(null);setNotice(command.message);setShowOpening(false);setShowAsset(false);
      try{setData(await load());}catch{setData(null);setError('Se guardó la operación. Actualizá la ficha para consultar los saldos.');}
    }catch(e){setError((e as {message?:string}).message||'No recibimos confirmación. Reintentá la misma operación.');}
    finally{setBusy(false);}
  }
  function opening(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const f=new FormData(event.currentTarget);
    const lines=(data?.products||[]).filter(p=>p.active&&p.returnable).map(p=>({product_id:p.id,quantity:Number(f.get(p.id)||0)}));
    if(lines.some(p=>!Number.isInteger(p.quantity)||p.quantity<0||p.quantity>100000)){setError('Ingresá cantidades enteras entre 0 y 100000.');return;}
    const items=lines.filter(p=>p.quantity>0);if(!items.length){setError('Ingresá los envases que ya tiene el cliente.');return;}
    void execute({name:'inventory_owner_stock',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_kind:'opening_customer',p_customer:customer.id,p_items:items,p_note:'Conteo inicial desde la ficha del cliente'},message:'Envases iniciales registrados en este cliente.'});
  }
  function assign(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const f=new FormData(event.currentTarget),asset=data?.assets.find(a=>a.id===f.get('asset')&&a.ownership==='company'&&a.location==='depot');
    if(!asset){setError('Elegí un dispenser del depósito.');return;}
    try{const monthly=mode==='rental'?parseMoney(String(f.get('monthly')))/100:0;
      if(mode==='rental'&&monthly<=0)throw new Error();
      void execute({name:'inventory_save_dispenser',args:{p_tenant:tenantId,p_operation:crypto.randomUUID(),p_id:asset.id,p_name:asset.name,p_serial:asset.serial,p_ownership:'company',p_location:'customer',p_customer:customer.id,p_trip:null,p_mode:mode,p_monthly:monthly},message:'Dispenser asignado al cliente.'});
    }catch{setError('Ingresá un alquiler mensual mayor que cero.');}
  }
  const locked=busy||!!pending, assigned=data?.assets.filter(a=>a.customer_id===customer.id&&a.location==='customer')||[];
  return <section className="panel owner-customer-sheet" aria-labelledby="customer-sheet-title"><div className="section-heading"><div><span className="hd-kicker">FICHA DEL CLIENTE</span><h2 id="customer-sheet-title">{customer.name}</h2><p>{customer.address}{customer.phone?` · ${customer.phone}`:''}</p></div><div className="customer-actions"><button disabled={locked} onClick={onEdit}>Editar datos</button><button disabled={locked} onClick={onClose}>Volver a clientes</button></div></div>
    {error&&<p className="stock-error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {pending&&!busy&&<div className="notice"><p>No se confirmó el resultado. No cierres la ficha; reintentá para verificarlo sin duplicar.</p><button onClick={()=>void execute(pending)}>Reintentar misma operación</button></div>}
    {!data?<><p role="status">{error?'Ficha sin actualizar.':'Consultando ficha…'}</p><button disabled={locked} onClick={()=>setVersion(v=>v+1)}>Actualizar ficha</button></>:<>
      <div className="customer-sheet-grid"><section><h3>Bidones y envases que tiene</h3>{data.held.filter(h=>Number(h.quantity)>0).map(h=><div className="customer-held-row" key={h.product_id}><strong>{data.products.find(p=>p.id===h.product_id)?.name||'Artículo anterior'}</strong><span>{Number(h.quantity)} para devolver</span></div>)}{!data.held.some(h=>Number(h.quantity)>0)&&<p>No hay envases registrados en su poder.</p>}<button className="primary" disabled={locked} aria-expanded={showOpening} onClick={()=>setShowOpening(v=>!v)}>Registrar bidones que ya tiene</button>
      {showOpening&&<form onSubmit={opening}><fieldset disabled={locked}><p className="notice">Conteo inicial anterior al uso de HidroTrack. Suma estos envases al patrimonio propio. No cargues aquí unidades que ya contaste en depósito o entregas. Cada artículo admite una apertura por cliente antes de sus movimientos.</p>{data.products.filter(p=>p.returnable&&p.active).map(p=><label key={p.id}>Envases iniciales de {p.name}<input name={p.id} type="number" min="0" max="100000" step="1" inputMode="numeric" defaultValue="0"/></label>)}{!data.products.some(p=>p.active&&p.returnable)&&<p>Primero agregá un envase retornable en Catálogo.</p>}<button className="primary">Guardar envases iniciales</button></fieldset></form>}</section>
      <section><h3>Dispenser del cliente</h3>{assigned.map(a=><article className="customer-held-row" key={a.id}><div><strong>{a.name}</strong><small>{a.serial||'Sin identificación'} · {a.ownership==='customer'?'Propiedad del cliente':a.mode==='rental'?`Alquiler ${currency(Number(a.monthly)*100)}/mes`:'Préstamo gratuito'}</small></div></article>)}{!assigned.length&&<p>No hay dispenser asignados.</p>}<button className="primary" disabled={locked} aria-expanded={showAsset} onClick={()=>setShowAsset(v=>!v)}>Asignar dispenser</button>
      {showAsset&&<form onSubmit={assign}><fieldset disabled={locked}><label>Dispenser disponible<select name="asset" required><option value="">Elegí un equipo del depósito</option>{data.assets.filter(a=>a.ownership==='company'&&a.location==='depot').map(a=><option key={a.id} value={a.id}>{a.name} · {a.serial||a.id.slice(0,8)}</option>)}</select></label><p>Los equipos se registran primero en Dispenser. Aquí podés asignar uno existente sin duplicarlo.</p><label>Modalidad del dispenser<select value={mode} onChange={e=>setMode(e.target.value)}><option value="loan">Préstamo gratuito</option><option value="rental">Alquiler</option></select></label>{mode==='rental'&&<label>Cuota mensual ($)<input name="monthly" required inputMode="decimal"/></label>}<button className="primary">Guardar dispenser del cliente</button></fieldset></form>}</section></div>
      <section><h3>Movimientos del cliente</h3>{data.operations.map(o=><article className="customer-held-row" key={o.id}><div><strong>{o.kind==='opening_customer'?'Inventario inicial':o.kind==='delivery'?'Entrega / devolución':'Movimiento de inventario'}</strong><small>{new Date(o.created_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})} · {o.note||'Sin observaciones'}</small>{o.items?.map(i=><small key={i.product_id}>{data.products.find(p=>p.id===i.product_id)?.name||'Artículo'}: {i.quantity}</small>)}</div></article>)}{!data.operations.length&&<p>Todavía no hay movimientos registrados.</p>}</section>
    </>}
  </section>;
}
