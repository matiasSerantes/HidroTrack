import './OwnerStock.css';
import {OwnerStockIncident} from './OwnerStockIncident';
import {demoDay,type DemoProgramState} from '../domain/programDemo';
import {recordDemoStock,type StockEvent} from '../domain/stockIncidentDemo';
export function DemoStockIncidents({state:s,actor,onChange}:{state:DemoProgramState;actor:string;onChange:(update:(state:DemoProgramState)=>DemoProgramState)=>void}){
  return <div className="owner-stock"><OwnerStockIncident today={demoDay} tenantId="demo" products={s.products} assets={[]} customers={s.clients} members={s.members.map(m=>({user_id:m.id,role:m.role}))} profiles={s.members.map(m=>({user_id:m.id,full_name:m.name}))} trips={s.trips.map(t=>({id:t.id,name:t.name,status:t.stage}))} locked={false} enabled={true} onSubmit={command=>{
    const a=command.args;if(command.name!=='inventory_remove')return;
    onChange(state=>recordDemoStock(state,{productId:String(a.p_product),quantity:Number(a.p_quantity),kind:a.p_kind as StockEvent['kind'],source:a.p_source as StockEvent['source'],tripId:a.p_trip?String(a.p_trip):undefined,customerId:a.p_customer?String(a.p_customer):undefined,date:String(a.p_date),actorId:actor,involvedKind:a.p_involved_kind as StockEvent['involvedKind'],involvedId:String(a.p_involved_id),note:String(a.p_note)}));
  }}/><section className="stock-panel"><h3>Historial de bajas y roturas · demo</h3>{(s.stockEvents||[]).map(e=><article key={e.id}><strong>{e.kind==='damage'?'Rotura':'Baja'} · {e.quantity} × {s.products.find(p=>p.id===e.productId)?.name}</strong><p>{e.date} · {s.members.find(m=>m.id===e.involvedId)?.name||s.clients.find(c=>c.id===e.involvedId)?.name} · {e.note}</p><small>Registrado por {s.members.find(m=>m.id===e.actorId)?.name} · {new Date(e.registeredAt).toLocaleString('es-AR')}</small></article>)}<p>Datos ficticios guardados en este navegador. Para rotura de un equipo individualizado, usá Dispenser en la cuenta real cuando se aplique la actualización de base.</p></section></div>;
}
