import {CustomerContainerCorrection} from './CustomerContainerCorrection';
import type {Client,DemoProgramState} from '../domain/programDemo';
export function DemoContainerCorrection({client,state,act}:{client:Client;state:DemoProgramState;act:(fn:(s:DemoProgramState)=>DemoProgramState,text?:string)=>boolean}){
 return <CustomerContainerCorrection products={state.products.map(p=>({...p,family:p.kind==='rental'?'dispenser':'article'}))} held={Object.entries(client.held).map(([product_id,quantity])=>({product_id,quantity}))} disabled={false} onSubmit={value=>act(s=>{
 const next=structuredClone(s),c=next.clients.find(c=>c.id===client.id),p=next.products.find(p=>p.id===value.product);
 if(!c||!p||!p.returnable||p.kind==='rental'||!c.active)throw new Error('Cliente o articulo no disponible');
 const current=c.held[p.id]||0,delta=value.quantity-current;
 if(delta>0&&!p.active)throw new Error('Articulo inactivo');
 if(current!==value.expected)throw new Error('El conteo cambio; actualiza la planilla');
 const available=value.source==='depot_ready'?p.depot:(next.depotEmpties[p.id]||0);
 if(delta>available)throw new Error('No hay suficientes bidones en el deposito elegido');
 if(value.source==='depot_ready')p.depot-=delta;else next.depotEmpties[p.id]=available-delta;
 c.held[p.id]=value.quantity;return next;
 },'Cantidad de bidones corregida en demo; total propio conservado.')}/>;
}
