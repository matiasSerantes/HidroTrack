// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssistantVisit} from '../src/features/AssistantVisit';
import {OwnerCreditInbox} from '../src/features/OwnerCreditInbox';
afterEach(cleanup);
const detail={customer:{id:'c',name:'Cliente de prueba',pending_recovery:false},version:3,outcome:'pending',balance:500,products:[{id:'p',name:'Agua 20 L',price:100,active:true,returnable:true,ready:5,held:2}],equipment:[]};
it('confirma cantidades pago y version y reintenta exactamente el mismo comando si no hay respuesta',async()=>{
 let attempts=0;const onChanged=vi.fn(),onLock=vi.fn();const client={rpc:vi.fn(async(name,args)=>{if(name==='assistant_customer_visit')return {data:detail,error:null};attempts++;if(attempts===1)return {data:null,error:{message:'Sin conexión'}};return {data:{id:args.p_id,total:200,paid:100,remaining:100,credit_status:'pending'},error:null};})};
 render(<AssistantVisit client={client} tenantId="a" tripId="t" customerId="c" resolved={false} onLock={onLock} onChanged={onChanged}/>);
 fireEvent.click(screen.getByRole('button',{name:'Atender cliente'}));await screen.findByText('Planilla de Cliente de prueba');
 fireEvent.change(screen.getByLabelText('Entregar Agua 20 L'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('Devuelve Agua 20 L'),{target:{value:'1'}});expect(screen.getByText('Quedarán 3 envases para la próxima visita.')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Cuánto paga ahora ($)'),{target:{value:'100'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar entrega y cobro'}));
 await screen.findByText('Sin conexión');expect(screen.getByLabelText('Entregar Agua 20 L').closest('fieldset').disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Reintentar misma entrega'}));await screen.findByText(/Entrega confirmada:/);
 const commands=client.rpc.mock.calls.filter(([n])=>n==='assistant_deliver').map(([,args])=>args);expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);expect(commands[0]).toMatchObject({p_version:3,p_expected_total:200,p_paid:100,p_method:'cash',p_items:[{product_id:'p',quantity:2,returned:1}]});expect(onChanged).toHaveBeenCalledTimes(1);
});
it('error SQL obliga a actualizar planilla sin declarar entrega confirmada',async()=>{
 const client={rpc:vi.fn(async name=>name==='assistant_customer_visit'?{data:detail,error:null}:{data:null,error:{code:'P0001',message:'El precio cambio'}})};
 render(<AssistantVisit client={client} tenantId="a" tripId="t" customerId="c" resolved={false} onLock={()=>{}} onChanged={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Atender cliente'}));await screen.findByText('Planilla de Cliente de prueba');fireEvent.change(screen.getByLabelText('Entregar Agua 20 L'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar entrega y cobro'}));
 await screen.findByText('El precio cambio');expect(screen.queryByText(/Entrega confirmada:/)).toBe(null);expect(screen.queryByRole('button',{name:'Reintentar misma entrega'})).toBe(null);expect(screen.getByRole('button',{name:'Actualizar planilla'})).toBeTruthy();
});
it('jefe rechaza credito mediante el contrato existente y conserva aviso de saldo a cobrar',async()=>{
 let pending=true;const client={rpc:vi.fn(async name=>{if(name==='owner_credit_inbox')return {data:{count:pending?1:0,items:pending?[{sale_id:'sale',customer:'Cliente A',trip:'Ruta',created_at:'2026-10-24T12:00:00Z',total:200,initial_paid:100,balance:100}]:[]},error:null};pending=false;return {data:'rejected',error:null};})};
 render(<OwnerCreditInbox client={client} tenantId="a" disabled={false}/>);fireEvent.click(await screen.findByRole('button',{name:'Rechazar deuda'}));await screen.findByText('Deuda rechazada. El importe sigue pendiente de cobro al cliente.');await waitFor(()=>expect(client.rpc.mock.calls.some(([n,args])=>n==='commerce_review_credit'&&args.p_approve===false&&args.p_sale==='sale')).toBe(true));
});
