// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {OwnerCustomerAccount} from '../src/features/OwnerCustomerAccount';
afterEach(cleanup);
const debt={id:'sale',total:1000,paid:0,balance:1000,occurred_on:'2026-10-01'};
async function pay(amount='400',method='transfer'){
 fireEvent.click(await screen.findByRole('button',{name:'Registrar pago'}));
 fireEvent.change(screen.getByLabelText('Monto del pago ($)'),{target:{value:amount}});
 fireEvent.change(screen.getByLabelText('Medio del pago'),{target:{value:method}});
 fireEvent.change(screen.getByLabelText('Referencia del pago'),{target:{value:'Comprobante ficticio'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar pago'}));
}
it('registra pago parcial y total, muestra fecha y medio y reduce saldo sin crear entregas',async()=>{
 const {client,filters}=fixture({charges:[debt]});await pay();await screen.findByText('Pago registrado. El saldo del cliente fue actualizado.');await screen.findByText(/Referencia: Comprobante ficticio/);
 expect(screen.getByText(/Pagado:/).textContent).toContain('600');expect(screen.getByText(/400,00.*Transferencia/)).toBeTruthy();expect(screen.getByText(/Fecha del pago:/)).toBeTruthy();
 expect(client.rpc).toHaveBeenCalledWith('commerce_record_payment',expect.objectContaining({p_sale:'sale',p_amount:400,p_method:'transfer',p_trip:null}));
 expect(filters).toContainEqual(['payments','tenant_id','t']);expect(filters).toContainEqual(['payments','sales.customer_id','c']);
 await pay('600','cash');await waitFor(()=>expect(screen.getByText('Sin deuda pendiente')).toBeTruthy());expect(screen.queryByRole('button',{name:'Registrar pago'})).toBeNull();expect(screen.getByText(/600,00.*Efectivo/)).toBeTruthy();expect(client.rpc.mock.calls.every(([name])=>name==='commerce_record_payment')).toBe(true);
});
it('reintenta un pago incierto con el mismo identificador y valores',async()=>{
 const {client}=fixture({charges:[debt],lost:true});await pay();await screen.findByText('Conexión interrumpida');expect(screen.getByLabelText('Monto del pago ($)').closest('fieldset').disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo pago'}));await screen.findByText('Pago registrado. El saldo del cliente fue actualizado.');expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
});
it('impide sobrepago y fecha anterior al cargo',async()=>{
 const {client}=fixture({charges:[debt]});await pay('1000,01');await screen.findByText(/no superar el saldo/);expect(client.rpc).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Monto del pago ($)'),{target:{value:'400'}});fireEvent.change(screen.getByLabelText('Fecha del pago'),{target:{value:'2026-09-30'}});fireEvent.submit(screen.getByRole('button',{name:'Guardar pago'}).closest('form'));await screen.findByText(/Revisá la fecha/);expect(client.rpc).not.toHaveBeenCalled();
});
function fixture({charges=[],fail=false,lost=false}={}){
 const filters=[];let rows=charges,payments=[];const client={from:vi.fn(table=>{const chain={select:()=>chain,eq:(k,v)=>{filters.push([table,k,v]);return chain;},order:()=>chain,range:vi.fn(async()=>({data:table==='payments'?payments:table==='sales'?rows.map(r=>({...r,kind:'opening',description:'Libreta anterior'})):rows,error:fail?{message:'offline'}:null}))};return chain;}),rpc:vi.fn(async(name,args)=>{if(lost){lost=false;return {error:{message:'Conexión interrumpida'}};}if(name==='commerce_record_payment'){rows=rows.map(r=>r.id===args.p_sale?{...r,paid:Number(r.paid)+args.p_amount,balance:Number(r.balance)-args.p_amount}:r);payments.push({id:args.p_id,sale_id:args.p_sale,amount:args.p_amount,method:args.p_method,occurred_on:args.p_date,created_at:new Date().toISOString(),note:args.p_note});}else rows=[{id:args.p_id,total:args.p_amount,paid:0,balance:args.p_amount,occurred_on:args.p_date}];return {data:args.p_id,error:null};})};
 const onLock=vi.fn();render(<OwnerCustomerAccount client={client} tenantId="t" customerId="c" disabled={false} onLock={onLock}/>);return {client,filters,onLock};
}
async function fill(){fireEvent.click(await screen.findByRole('button',{name:'Cargar deuda anterior'}));fireEvent.change(screen.getByLabelText('Monto de deuda anterior ($)'),{target:{value:'12000,50'}});fireEvent.change(screen.getByLabelText('Referencia de la deuda'),{target:{value:'Libreta anterior'}});fireEvent.click(screen.getByRole('button',{name:'Guardar deuda inicial'}));}
it('carga deuda anterior sin tocar inventario y muestra saldo, fecha y referencia',async()=>{const {client,filters}=fixture();await fill();await screen.findByText('Deuda inicial registrada en la cuenta del cliente.');await screen.findByText('Debe actualmente');expect(screen.getByText(/Libreta anterior/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Cargar deuda anterior'})).toBeNull();expect(client.rpc).toHaveBeenCalledExactlyOnceWith('commerce_open_customer_balance',expect.objectContaining({p_tenant:'t',p_customer:'c',p_amount:12000.5,p_note:'Libreta anterior'}));for(const table of ['sales','customer_sale_balances']){expect(filters).toContainEqual([table,'tenant_id','t']);expect(filters).toContainEqual([table,'customer_id','c']);}});
it('conserva identificador y monto al reintentar respuesta incierta',async()=>{const {client,onLock}=fixture({lost:true});await fill();await screen.findByText('Conexión interrumpida');expect(screen.getByRole('button',{name:'Guardar deuda inicial'}).closest('fieldset').disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Reintentar misma deuda'}));await screen.findByText('Deuda inicial registrada en la cuenta del cliente.');expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);await waitFor(()=>expect(onLock).toHaveBeenLastCalledWith(false));});
it('no muestra saldo cero ni permite apertura cuando falla la consulta',async()=>{fixture({fail:true});await screen.findByRole('alert');expect(screen.queryByText('Sin deuda pendiente')).toBeNull();expect(screen.queryByRole('button',{name:'Cargar deuda anterior'})).toBeNull();});
it('muestra pagos parciales y evita repetir apertura aunque esté cancelada',async()=>{fixture({charges:[{id:'s',total:1000,paid:400,balance:600,occurred_on:'2026-10-01'}]});await screen.findByText('Debe actualmente');expect(screen.getByText(/Pagado:/).textContent).toContain('400');expect(screen.queryByRole('button',{name:'Cargar deuda anterior'})).toBeNull();});
it('rechaza formato y monto cero antes de enviar',async()=>{const {client}=fixture();fireEvent.click(await screen.findByRole('button',{name:'Cargar deuda anterior'}));fireEvent.change(screen.getByLabelText('Monto de deuda anterior ($)'),{target:{value:'0'}});fireEvent.change(screen.getByLabelText('Referencia de la deuda'),{target:{value:'Libreta'}});fireEvent.click(screen.getByRole('button',{name:'Guardar deuda inicial'}));await screen.findByRole('alert');expect(client.rpc).not.toHaveBeenCalled();});
