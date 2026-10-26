import { OwnerCustomerAccount } from './OwnerCustomerAccount';
import { DispenserExchange, DispenserExchangeHistory } from './DispenserExchange';
import { ExternalNavigation } from './ExternalNavigation';
import { OwnerCustomerHabits } from './OwnerCustomerHabits';
import { ExtraVisitRequests } from './ExtraVisitRequests';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMoney, currency } from '../domain/demo';
import {isDispenserModel,stockToday} from './OwnerStockIncident';

type Customer = {latitude?:number|null;longitude?:number|null;created_at?:string;id:string;name:string;address:string;phone:string};
type Product = {family?:string;id:string;name:string;active:boolean;returnable:boolean};
type Asset = {retired?:boolean;id:string;name:string;serial:string;ownership:string;location:string;customer_id:string|null;mode:string|null;monthly:number};
type ModelAssignment={id:string;product_id:string;customer_id:string;mode:string;monthly:number;status:string;occurred_on:string;last_exchange_on?:string|null;last_operation?:string};
type Snapshot = {modelEnabled:boolean;assignments:ModelAssignment[];balances:{product_id:string;depot_ready:number}[];truck:{product_id:string;trip_id:string;ready:number}[];trips:{id:string;name:string;status:string;service_date?:string}[];products:Product[];held:{product_id:string;quantity:number}[];assets:Asset[];operations:{id:string;kind:string;source?:string|null;created_at:string;note:string;items:{product_id:string;quantity:number}[]}[]};
type Command = {name:string;args:Record<string,unknown>;message:string};

export function OwnerCustomerSheet({client,tenantId,customer,onClose,onEdit,onLock,onArchive,disabled=false}:{client:SupabaseClient;tenantId:string;customer:Customer;onClose:()=>void;onEdit:()=>void;onArchive?:()=>void;disabled?:boolean;onLock:(value:boolean)=>void}) {
  const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
  const [showOpening,setShowOpening]=useState(false),[showAsset,setShowAsset]=useState(false),[mode,setMode]=useState('loan'),[selection,setSelection]=useState('');
  const [showDispenserOpening,setShowDispenserOpening]=useState(false);
  const [habitsBusy,setHabitsBusy]=useState(false);
  const [extraBusy,setExtraBusy]=useState(false);
  const [accountBusy,setAccountBusy]=useState(false);
  const [containerOrigin,setContainerOrigin]=useState('depot_empty');
  useEffect(()=>{onLock(busy||!!pending||habitsBusy||extraBusy||accountBusy);return()=>onLock(false);},[busy,pending,habitsBusy,extraBusy,accountBusy,onLock]);
  async function load():Promise<Snapshot>{
    const results=await Promise.all([
      client.from('products').select('*').eq('tenant_id',tenantId).order('name'),
      client.from('inventory_customer_containers').select('product_id,quantity').eq('tenant_id',tenantId).eq('customer_id',customer.id),
      client.from('dispensers').select('*').eq('tenant_id',tenantId).order('name'),
      client.from('inventory_operations').select('id,kind,source,created_at,note,items').eq('tenant_id',tenantId).eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(30),
      client.from('inventory_owned_stock').select('product_id,depot_ready').eq('tenant_id',tenantId),
      client.from('inventory_truck_stock').select('product_id,trip_id,ready').eq('tenant_id',tenantId),
      client.from('inventory_trips').select('id,name,status,service_date').eq('tenant_id',tenantId),
      client.from('dispenser_assignments').select('*').eq('tenant_id',tenantId).eq('customer_id',customer.id),
    ]);
    if(results.slice(0,7).some(r=>r.error))throw new Error('No pudimos cargar la ficha. Revisá la conexión e intentá nuevamente.');
    return {modelEnabled:!results[7].error,assignments:results[7].data||[],balances:results[4].data||[],truck:results[5].data||[],trips:results[6].data||[],products:results[0].data||[],held:results[1].data||[],assets:results[2].data||[],operations:results[3].data||[]} as Snapshot;
  }
  useEffect(()=>{let active=true;void load().then(d=>{if(active){setData(d);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[client,tenantId,customer.id,version]);
  async function refreshAvailability(){
    if(busy||pending||disabled||habitsBusy||extraBusy||accountBusy)return;
    setBusy(true);setError('');setSelection('');
    try{setData(await load());}catch(e){setError((e as Error).message);setData(null);}finally{setBusy(false);}
  }
  async function execute(command:Command){
    if(busy)return;setBusy(true);setPending(command);setError('');setNotice('');
    try{
      const result=await client.rpc(command.name,command.args);
      if(result.error){if(result.error.code)setPending(null);throw result.error;}
      setPending(null);setNotice(command.message);setShowOpening(false);setShowAsset(false);setShowDispenserOpening(false);setSelection('');
      try{setData(await load());}catch{setData(null);setError('Se guardó la operación. Actualizá la ficha para consultar los saldos.');}
    }catch(e){setError((e as {message?:string}).message||'No recibimos confirmación. Reintentá la misma operación.');}
    finally{setBusy(false);}
  }
  function opening(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const f=new FormData(event.currentTarget);
    const lines=(data?.products||[]).filter(p=>p.active&&p.returnable&&!isDispenserModel(p)).map(p=>({product_id:p.id,quantity:Number(f.get(p.id)||0)}));
    if(lines.some(p=>!Number.isInteger(p.quantity)||p.quantity<0||p.quantity>100000)){setError('Ingresá cantidades enteras entre 0 y 100000.');return;}
    const items=lines.filter(p=>p.quantity>0);if(!items.length){setError('Ingresá los envases que ya tiene el cliente.');return;}
    const existing=containerOrigin!=='uncounted';
    void execute({name:existing?'inventory_assign_existing_containers':'inventory_record_stock',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_customer:customer.id,p_items:items,p_note:'Conteo inicial desde la ficha del cliente',p_date:f.get('date'),...(existing?{p_source:containerOrigin}:{p_kind:'opening_customer',p_trip:null})},message:existing?'Envases asignados desde el depósito. El total propio no cambió.':'Envases iniciales registrados en este cliente.'});
  }
  function assign(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const f=new FormData(event.currentTarget),value=String(f.get('asset')||'');
    try{const monthly=mode==='rental'?parseMoney(String(f.get('monthly')))/100:0;
      if(mode==='rental'&&monthly<=0)throw new Error();
      if(value.startsWith('model:')){
        const [,productId,origin]=value.split(':');
        if(!data?.modelEnabled||!data.products.some(p=>p.id===productId&&p.active&&isDispenserModel(p))){setError('El stock por modelo necesita la actualización de base de dispenser.');return;}
        void execute({name:'inventory_assign_dispenser_model',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_product:productId,p_customer:customer.id,p_mode:mode,p_monthly:monthly,p_date:f.get('date'),p_trip:origin==='depot'?null:origin},message:'Dispenser asignado desde stock. Ya no figura disponible.'});return;
      }
      const asset=data?.assets.find(a=>a.id===value&&a.ownership==='company'&&a.location==='depot'&&!a.retired);
      if(!asset){setError('Elegí un dispenser disponible.');return;}
      void execute({name:'inventory_save_dispenser',args:{p_tenant:tenantId,p_operation:crypto.randomUUID(),p_id:asset.id,p_name:asset.name,p_serial:asset.serial,p_ownership:'company',p_location:'customer',p_customer:customer.id,p_trip:null,p_mode:mode,p_monthly:monthly},message:'Dispenser asignado al cliente.'});
    }catch{setError('Ingresá un alquiler mensual mayor que cero.');}
  }
  function returnModel(event:FormEvent<HTMLFormElement>,id:string){event.preventDefault();const f=new FormData(event.currentTarget);void execute({name:'inventory_return_dispenser_model',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_assignment:id,p_date:f.get('date')},message:'Devolución registrada. El dispenser vuelve a estar disponible en depósito.'});}
  function registerDispenserUnits(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const f=new FormData(event.currentTarget),product=String(f.get('product')),quantity=Number(f.get('quantity'));
    if(!data?.modelEnabled||!data.products.some(p=>p.id===product&&p.active&&isDispenserModel(p))||!Number.isInteger(quantity)||quantity<1||quantity>100000){setError('Elegí un modelo de dispenser y una cantidad entera mayor que cero.');return;}
    void execute({name:'inventory_record_stock',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_kind:'receive',p_trip:null,p_customer:null,p_items:[{product_id:product,quantity}],p_note:String(f.get('note')||'Registro de unidades existentes desde la planilla del cliente'),p_date:f.get('date')},message:'Unidades de dispenser registradas. Ahora elegí Asignar dispenser para dejar una en este cliente.'});
  }
  const locked=busy||!!pending||disabled||habitsBusy||extraBusy||accountBusy, assignedModels=data?.assignments.filter(a=>a.status==='active')||[], assigned=data?.assets.filter(a=>a.customer_id===customer.id&&a.location==='customer'&&!a.retired)||[];
  const models=data?.products.filter(p=>p.active&&isDispenserModel(p))||[];
  const hasAvailable=!!data&&(data.assets.some(a=>a.ownership==='company'&&a.location==='depot'&&!a.retired)||models.some(p=>Number(data.balances.find(b=>b.product_id===p.id)?.depot_ready||0)>0||data.truck.some(b=>b.product_id===p.id&&Number(b.ready)>0&&data.trips.some(t=>t.id===b.trip_id&&t.status==='active'))));
  return <section className="panel owner-customer-sheet" aria-labelledby="customer-sheet-title"><div className="section-heading"><div><span className="hd-kicker">PLANILLA DEL CLIENTE</span><h2 id="customer-sheet-title">{customer.name}</h2><p>{customer.address}{customer.phone?` · ${customer.phone}`:''}</p></div><div className="customer-actions"><button disabled={locked} onClick={onEdit}>Editar datos</button><button disabled={locked} onClick={onClose}>Volver a clientes</button></div></div>
    <ExternalNavigation disabled={locked} selected={{...customer,geo:customer.latitude!=null&&customer.longitude!=null?{lat:customer.latitude,lng:customer.longitude}:undefined}}/><section className="customer-profile"><h3>Datos de la planilla</h3><p>Fecha de alta: {customer.created_at?new Date(customer.created_at).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'No registrada'}</p><p>Ubicación exacta: {customer.latitude!=null&&customer.longitude!=null?`${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}`:'Sin punto de mapa registrado'}</p>{customer.latitude!=null&&customer.longitude!=null&&<a target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${customer.latitude}&mlon=${customer.longitude}#map=19/${customer.latitude}/${customer.longitude}`}>Ver ubicación exacta en el mapa</a>}</section>
    {error&&<p className="stock-error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {pending&&!busy&&<div className="notice"><p>No se confirmó el resultado. No cierres la ficha; reintentá para verificarlo sin duplicar.</p><button onClick={()=>void execute(pending)}>Reintentar misma operación</button></div>}
    {!data?<><p role="status">{error?'Ficha sin actualizar.':'Consultando ficha…'}</p><button disabled={locked} onClick={()=>setVersion(v=>v+1)}>Actualizar ficha</button></>:<>
      <div className="customer-sheet-grid"><section><h3>Bidones y envases que tiene</h3>{data.held.filter(h=>Number(h.quantity)>0&&!isDispenserModel(data.products.find(p=>p.id===h.product_id)||{name:''})).map(h=><div className="customer-held-row" key={h.product_id}><strong>{data.products.find(p=>p.id===h.product_id)?.name||'Artículo anterior'}</strong><span>{Number(h.quantity)} para devolver</span></div>)}{!data.held.some(h=>Number(h.quantity)>0&&!isDispenserModel(data.products.find(p=>p.id===h.product_id)||{name:''}))&&<p>No hay envases registrados en su poder.</p>}<button className="primary" disabled={locked} aria-expanded={showOpening} onClick={()=>setShowOpening(v=>!v)}>Registrar bidones que ya tiene</button>
      {showOpening&&<form onSubmit={opening}><fieldset disabled={locked}><p className="notice">Si ya contaste estos bidones en el Catálogo o Stock, asignalos desde el depósito: no se suman otra vez al total. Por ejemplo, de 600 quedan 598 en depósito y 2 en el cliente. Solo elegí unidades no contadas si todavía no las registraste.</p><label>Origen de los bidones<select value={containerOrigin} onChange={e=>setContainerOrigin(e.target.value)}><option value="depot_empty">Ya contados: descontar de vacíos del depósito</option><option value="depot_ready">Ya contados: descontar de llenos del depósito</option><option value="uncounted">No estaban contados: agregar al total propio</option></select></label><label>Fecha del conteo inicial<input name="date" type="date" defaultValue={stockToday()} max={stockToday()} required/></label>{data.products.filter(p=>p.returnable&&p.active&&!isDispenserModel(p)).map(p=><label key={p.id}>Envases iniciales de {p.name}<input name={p.id} type="number" min="0" max="100000" step="1" inputMode="numeric" defaultValue="0"/></label>)}{!data.products.some(p=>p.active&&p.returnable&&!isDispenserModel(p))&&<p>Primero agregá un envase retornable en Catálogo.</p>}<button className="primary">Guardar envases iniciales</button></fieldset></form>}</section>
      <section><h3>Dispenser del cliente</h3>{assigned.map(a=><article className="customer-held-row" key={a.id}><div><strong>{a.name}</strong><small>{a.serial||'Sin identificación'} · {a.ownership==='customer'?'Propiedad del cliente':a.mode==='rental'?`Alquiler ${currency(Number(a.monthly)*100)}/mes`:'Préstamo gratuito'}</small></div></article>)}{assignedModels.map(a=><article className="customer-held-row" key={a.id}><div><strong>{data.products.find(p=>p.id===a.product_id)?.name||'Dispenser'}</strong><small>1 unidad · {a.mode==='rental'?`Alquiler ${currency(Number(a.monthly)*100)}/mes`:'Préstamo gratuito'} · Desde {a.occurred_on}</small><form onSubmit={e=>returnModel(e,a.id)}><label>Fecha de devolución<input name="date" type="date" min={a.last_exchange_on||a.occurred_on} max={stockToday()} defaultValue={stockToday()} required disabled={locked}/></label><button disabled={locked}>Registrar devolución</button></form><DispenserExchange key={`${a.id}.${a.last_operation||a.product_id}`} tenantId={tenantId} assignment={a} products={data.products} balances={data.balances} truck={data.truck} trips={data.trips} locked={locked} onSubmit={command=>void execute(command)}/></div></article>)}{!assigned.length&&!assignedModels.length&&<p>No hay dispenser asignados.</p>}<button className="primary" disabled={locked} aria-expanded={showAsset} onClick={()=>setShowAsset(v=>!v)}>Asignar dispenser</button>
      <button className="primary" disabled={locked} onClick={()=>void refreshAvailability()}>Actualizar disponibilidad</button>
      {!hasAvailable&&<div className="notice" role="status"><strong>No hay unidades de dispenser disponibles para asignar.</strong><p>Crear el modelo en el Catálogo no registra equipos. Primero indicá cuántas unidades tenés; despu?s asigná una al cliente.</p>{models.map(p=><p key={p.id}>{p.name}: {Number(data.balances.find(b=>b.product_id===p.id)?.depot_ready||0)} disponibles en depósito</p>)}<p>Si ya están contadas en stock, no las vuelvas a ingresar: revisá si están en un camión, con otro cliente o retiradas.</p></div>}
      {models.length>0&&<button className="primary" disabled={locked||!data.modelEnabled} onClick={()=>setShowDispenserOpening(v=>!v)}>Registrar unidades de dispenser</button>}
      {showDispenserOpening&&<form onSubmit={registerDispenserUnits}><fieldset disabled={locked}><h3>Registrar unidades existentes</h3><p>Solo para equipos que todavía no están contados en tu inventario. Se registran disponibles y luego podés asignarlos al cliente; no ingreses de nuevo los ya cargados.</p><label>Modelo de dispenser<select name="product" required>{models.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Unidades que aún no registraste<input name="quantity" type="number" min="1" max="100000" step="1" required/></label><label>Fecha de ingreso del dispenser<input name="date" type="date" defaultValue={stockToday()} max={stockToday()} required/></label><label>Referencia del ingreso<input name="note" maxLength={400}/></label><button className="primary">Registrar unidades existentes</button><button type="button" onClick={()=>setShowDispenserOpening(false)}>Cancelar ingreso</button></fieldset></form>}
      {showAsset&&<form onSubmit={assign}><fieldset disabled={locked}><label>Dispenser disponible<select name="asset" disabled={!hasAvailable} value={selection} onChange={e=>setSelection(e.target.value)} required><option value="">Elegí un dispenser disponible</option><optgroup label="Stock por modelo">{data.products.filter(p=>p.active&&isDispenserModel(p)).flatMap(p=>{const depot=Number(data.balances.find(b=>b.product_id===p.id)?.depot_ready||0);return [...(depot>0?[<option disabled={!data.modelEnabled} key={`${p.id}.depot`} value={`model:${p.id}:depot`}>{p.name} · {depot} disponibles en depósito</option>]:[]),...data.truck.filter(b=>b.product_id===p.id&&Number(b.ready)>0&&data.trips.some(t=>t.id===b.trip_id&&t.status==='active')).map(b=><option disabled={!data.modelEnabled} key={`${p.id}.${b.trip_id}`} value={`model:${p.id}:${b.trip_id}`}>{p.name} · {Number(b.ready)} disponibles en {data.trips.find(t=>t.id===b.trip_id)?.name}</option>)];})}</optgroup><optgroup label="Equipos individualizados">{data.assets.filter(a=>a.ownership==='company'&&a.location==='depot'&&!a.retired).map(a=><option key={a.id} value={a.id}>{a.name} · {a.serial||a.id.slice(0,8)}</option>)}</optgroup></select></label><p>El stock disponible por modelo aparece aquí sin volver a cargar cada equipo. Asignarlo descuenta una unidad disponible; devolverlo la libera.</p>{!data.modelEnabled&&<p className="notice">La asignación desde stock por modelo necesita aplicar la actualización de base. Los equipos individualizados siguen disponibles.</p>}{selection.startsWith('model:')&&<label>Fecha de asignación<input name="date" type="date" max={stockToday()} defaultValue={stockToday()} required/></label>}<label>Modalidad del dispenser<select value={mode} onChange={e=>setMode(e.target.value)}><option value="loan">Préstamo gratuito</option><option value="rental">Alquiler</option></select></label>{mode==='rental'&&<label>Cuota mensual ($)<input name="monthly" required inputMode="decimal"/></label>}<button className="primary" disabled={!selection||!hasAvailable}>Guardar dispenser del cliente</button></fieldset></form>}</section></div>
      <DispenserExchangeHistory client={client} tenantId={tenantId} customerId={customer.id} products={data.products} version={data.assignments.map(a=>a.last_operation||a.id).join(',')}/><section><h3>Movimientos del cliente</h3>{data.operations.map(o=><article className="customer-held-row" key={o.id}><div><strong>{o.kind==='opening_customer'?(o.source?'Asignados desde depósito':'Inventario inicial'):o.kind==='delivery'?'Entrega / devolución':o.kind==='dispenser_assign'?'Dispenser asignado':o.kind==='dispenser_return'?'Devolución de dispenser':'Movimiento de inventario'}</strong><small>{new Date(o.created_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})} · {o.note||'Sin observaciones'}</small>{o.items?.map(i=><small key={i.product_id}>{data.products.find(p=>p.id===i.product_id)?.name||'Artículo'}: {i.quantity}</small>)}</div></article>)}{!data.operations.length&&<p>Todavía no hay movimientos registrados.</p>}</section>
    </>}
    {data&&<OwnerCustomerAccount key={`${tenantId}.${customer.id}`} client={client} tenantId={tenantId} customerId={customer.id} disabled={busy||!!pending||disabled||habitsBusy||extraBusy} onLock={setAccountBusy}/>}
    {data&&<OwnerCustomerHabits client={client} tenantId={tenantId} customerId={customer.id} createdAt={customer.created_at} disabled={busy||!!pending||disabled||extraBusy||accountBusy} onLock={setHabitsBusy}/>}
    {data&&<ExtraVisitRequests client={client} tenantId={tenantId} customerId={customer.id} products={data.products} trips={data.trips} disabled={busy||!!pending||disabled||habitsBusy||accountBusy} onLock={setExtraBusy}/>}
    {onArchive&&<section className="customer-archive-section"><h3>Administración del cliente</h3><p>Archivar lo retira de los clientes activos. Conserva su historial, envases y equipos registrados.</p><div className="customer-actions"><button className="customer-delete" disabled={locked} onClick={onArchive}>Archivar cliente</button></div></section>}
  </section>;
}
