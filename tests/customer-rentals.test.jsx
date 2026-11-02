// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {OwnerCustomerRentals} from '../src/features/OwnerCustomerRentals';
afterEach(cleanup);
const contract={id:'assignment',source:'assignment',label:'Dispenser frio calor',monthly:1000,anchor:'2026-10-02',terms:'Acuerdo del jefe',next_period:1,period_start:'2026-11-02',period_end:'2026-12-02'};
function view(rpc){return render(<OwnerCustomerRentals client={{rpc}} tenantId="company" customerId="customer" disabled={false} onLock={vi.fn()} onChanged={vi.fn()}/>);}
it('genera cuota con importe y contrato esperados y reintenta el mismo ID al perder respuesta',async()=>{
 let unknown=true;const rpc=vi.fn(async(name,args)=>name==='owner_customer_rentals'?{data:{as_of:'2026-11-02',contracts:[contract],charges:[]},error:null}:unknown?{data:null,error:{message:'Respuesta desconocida'}}:{data:args.p_id,error:null});view(rpc);
 fireEvent.click(await screen.findByRole('button',{name:/Generar cuota de/}));expect(await screen.findByRole('button',{name:'Reintentar misma cuota'})).toBeTruthy();
 const first=rpc.mock.calls.find(([name])=>name==='owner_charge_rental_period')[1];expect(first).toMatchObject({p_customer:'customer',p_assignment:'assignment',p_period:1,p_date:'2026-11-02',p_expected_monthly:1000,p_expected_anchor:'2026-10-02'});
 unknown=false;fireEvent.click(screen.getByRole('button',{name:'Reintentar misma cuota'}));await screen.findByText('Cuota generada en la cuenta corriente. Todavía no registra un pago.');
 const writes=rpc.mock.calls.filter(([name])=>name==='owner_charge_rental_period');expect(writes[1][1]).toEqual(first);
});
it('permite al jefe editar su acuerdo sin modificar cargos ya generados',async()=>{
 const rpc=vi.fn(async(name,args)=>name==='owner_customer_rentals'?{data:{as_of:'2026-11-02',contracts:[contract],charges:[]},error:null}:{data:args.p_id,error:null});view(rpc);
 fireEvent.click(await screen.findByRole('button',{name:'Editar acuerdo de Dispenser frio calor'}));fireEvent.change(screen.getByLabelText('Importe mensual acordado ($)'),{target:{value:'1500'}});fireEvent.change(screen.getByLabelText('Condiciones acordadas con el cliente'),{target:{value:'Nuevo acuerdo libre'}});fireEvent.click(screen.getByRole('button',{name:'Guardar acuerdo del alquiler'}));
 await waitFor(()=>expect(rpc).toHaveBeenCalledWith('owner_edit_rental_agreement',expect.objectContaining({p_expected_monthly:1000,p_expected_terms:'Acuerdo del jefe',p_monthly:1500,p_terms:'Nuevo acuerdo libre'})));
 expect(await screen.findByText('Acuerdo de alquiler actualizado. Las cuotas ya generadas no cambiaron.')).toBeTruthy();
});
