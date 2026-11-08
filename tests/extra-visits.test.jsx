// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExtraVisitRequests } from '../src/features/ExtraVisitRequests';
afterEach(cleanup);
it('crea solicitud con productos desde planilla sin llamar contratos de stock',async()=>{
 const client={from:vi.fn(()=>{const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:async()=>({data:[],count:0,error:null})};return chain;}),rpc:vi.fn(async(name,args)=>({data:args.p_id,error:null}))};
 render(<ExtraVisitRequests client={client} tenantId="company-a" customerId="customer-a" products={[{id:'water',name:'Agua',active:true}]} trips={[]} disabled={false} onLock={()=>{}}/>);
 await screen.findByText('No hay visitas en esta lista.');fireEvent.click(screen.getByRole('button',{name:'Generar visita extraordinaria'}));
 fireEvent.change(screen.getByLabelText('Producto solicitado'),{target:{value:'water'}});fireEvent.change(screen.getByLabelText('Cantidad solicitada'),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Agregar al pedido'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar visita pendiente'}));
 await screen.findByText(/Visita extraordinaria guardada como pendiente/);
 expect(client.rpc).toHaveBeenCalledTimes(1);expect(client.rpc).toHaveBeenCalledWith('owner_request_extra_visit',expect.objectContaining({p_tenant:'company-a',p_customer:'customer-a',p_items:[{product_id:'water',quantity:2}]}));
});

it('guarda hora 18:30 como tarde en el pedido extraordinario',async()=>{
 const client={from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[],count:0,error:null})};return q;},rpc:vi.fn(async(_,args)=>({data:args.p_id,error:null}))};
 render(<ExtraVisitRequests client={client} tenantId="t" customerId="c" products={[{id:'p',name:'Agua',active:true}]} trips={[]} disabled={false} onLock={()=>{}}/>);await screen.findByText('No hay visitas en esta lista.');fireEvent.click(screen.getByText('Generar visita extraordinaria'));fireEvent.change(screen.getByLabelText('Hora solicitada'),{target:{value:'18'}});fireEvent.change(screen.getByLabelText('Minutos de la visita'),{target:{value:'30'}});fireEvent.change(screen.getByLabelText('Producto solicitado'),{target:{value:'p'}});fireEvent.click(screen.getByText('Agregar al pedido'));fireEvent.click(screen.getByText('Guardar visita pendiente'));await screen.findByText(/Visita extraordinaria guardada como pendiente/);expect(client.rpc).toHaveBeenCalledWith('owner_request_extra_visit_at',expect.objectContaining({p_time:'18:30:00',p_customer:'c'}));
});
