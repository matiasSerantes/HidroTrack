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
