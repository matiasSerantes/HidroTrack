// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssistantVisitActions} from '../src/features/AssistantVisitActions';
import {AssistantVisit} from '../src/features/AssistantVisit';
afterEach(cleanup);
it('ausencia permite elegir fecha futura y conserva version e identificador en el comando',async()=>{
 const onDone=vi.fn();const client={rpc:vi.fn(async(name,args)=>({data:{id:args.p_id,outcome:'absent',next_date:args.p_next_date},error:null}))};
 render(<AssistantVisitActions client={client} tenantId="a" tripId="t" customerId="c" version={5} resolved={false} disabled={false} onLock={()=>{}} onDone={onDone}/>);
 fireEvent.click(screen.getByRole('button',{name:'No está / no compró'}));fireEvent.change(screen.getByLabelText('Cuándo volver'),{target:{value:'date'}});fireEvent.change(screen.getByLabelText('Fecha para volver'),{target:{value:'2099-01-01'}});fireEvent.click(screen.getByRole('button',{name:'Guardar resultado de visita'}));
 await waitFor(()=>expect(onDone).toHaveBeenCalled());expect(client.rpc.mock.calls[0]).toMatchObject(['assistant_record_visit',{p_version:5,p_outcome:'absent',p_followup:'date',p_next_date:'2099-01-01',p_customer:'c'}]);
});
it('cobro previo reintenta mismo ID y saldo esperado sin volver a crear una venta',async()=>{
 let attempts=0;const onDone=vi.fn();const client={rpc:vi.fn(async(name,args)=>{if(name==='assistant_customer_debts')return {data:{count:1,balance:100,items:[{id:'old',kind:'opening',description:'Saldo anterior',occurred_on:'2026-01-01',balance:100,credit_status:'rejected'}]},error:null};attempts++;return attempts===1?{data:null,error:{message:'Respuesta perdida'}}:{data:{id:args.p_id,amount:40,remaining:60},error:null};})};
 render(<AssistantVisitActions client={client} tenantId="a" tripId="t" customerId="c" version={5} resolved={true} disabled={false} onLock={()=>{}} onDone={onDone}/>);
 expect(screen.getByRole('button',{name:'No está / no compró'}).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Cobrar saldo pendiente'}));await screen.findByText('Saldo anterior');expect(screen.getByText(/Deuda rechazada/)).toBeTruthy();fireEvent.change(screen.getByLabelText('Importe a cobrar ($)'),{target:{value:'40'}});fireEvent.click(screen.getByRole('button',{name:'Registrar cobro de este cargo'}));await screen.findByText('Respuesta perdida');fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo cobro'}));await waitFor(()=>expect(onDone).toHaveBeenCalled());
 const commands=client.rpc.mock.calls.filter(([n])=>n==='assistant_collect_debt').map(([,args])=>args);expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);expect(commands[0]).toMatchObject({p_sale:'old',p_expected_balance:100,p_amount:40,p_trip:'t'});expect(client.rpc.mock.calls.some(([n])=>n==='assistant_deliver')).toBe(false);
});
it('planilla resuelta permite cobrar deudas manteniendo deshabilitada otra entrega',async()=>{
 const client={rpc:vi.fn(async()=>({data:{customer:{id:'c',name:'Cliente',pending_recovery:false},version:2,outcome:'delivered',balance:100,products:[],equipment:[]},error:null}))};
 render(<AssistantVisit client={client} tenantId="a" tripId="t" customerId="c" resolved={true} onLock={()=>{}} onChanged={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Ver planilla y cobros'}));await screen.findByText('Planilla de Cliente');expect(screen.getByRole('button',{name:'Confirmar entrega y cobro'}).disabled).toBe(true);expect(screen.getByRole('button',{name:'Cobrar saldo pendiente'}).disabled).toBe(false);
});
