// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CustomerContactFields,readContactPatch} from '../src/features/CustomerContactFields';
import {CustomerAccountEntries} from '../src/features/CustomerAccountEntries';
import {selectedAddressText} from '../src/domain/addressSearch';
import {matchesCustomer} from '../src/domain/customerSearch';
afterEach(cleanup);
it('guarda hasta tres teléfonos y permite retirar uno sin dejar el valor anterior',()=>{
 render(<form><CustomerContactFields initial={{phone:'111',phone2:'222',phone3:'333',delivery_notes:'Timbre B'}}/></form>);
 expect(screen.queryByRole('button',{name:'Agregar otro número'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Quitar número 2'}));
 const form=new FormData(document.querySelector('form'));
 expect(readContactPatch(form,{phone2:'222',phone3:'333'})).toEqual({phone2:'333',phone3:'',delivery_notes:'Timbre B'});
 expect(matchesCustomer({name:'Prueba',address:'Calle 1',phone:'111',phone2:'+54 11 2222'},'112222')).toBe(true);
});
it('conserva altura escrita solo si coincide la calle y no inventa un punto exacto',()=>{
 const result={label:'El Chasque, Boulogne Sur Mer, Buenos Aires',hasNumber:false,lat:-34,lng:-58};
 expect(selectedAddressText(result,'3453,El Chasque, Boulogne').label).toContain('El Chasque 3453,');
 expect(selectedAddressText(result,'El Chasque 3453, Boulogne').numberFromQuery).toBe(true);
 expect(selectedAddressText(result,'3453, Otra calle').numberFromQuery).toBe(false);
 expect(selectedAddressText({...result,hasNumber:true},'Otra 100').label).toBe(result.label);
});
it('reintenta deuda incierta con el mismo importe, fecha e identificador',async()=>{
 const client={rpc:vi.fn().mockResolvedValueOnce({error:{message:'Sin conexión'}}).mockImplementation(async(_,args)=>({data:args.p_id}))},saved=vi.fn();
 render(<CustomerAccountEntries client={client} tenantId="t" customerId="c" total={10000} disabled={false} onLock={()=>{}} onSaved={saved}/>);
 fireEvent.click(screen.getByRole('button',{name:'Agregar deuda'}));
 fireEvent.change(screen.getByLabelText('Importe de la deuda ($)'),{target:{value:'1200'}});
 fireEvent.change(screen.getByLabelText('Descripción del movimiento'),{target:{value:'Bidones anteriores'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar nueva deuda'}));
 await screen.findByRole('button',{name:'Reintentar mismo movimiento de cuenta'});
 fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo movimiento de cuenta'}));
 await waitFor(()=>expect(saved).toHaveBeenCalled());expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
 expect(client.rpc.mock.calls[0][1]).toMatchObject({p_amount:1200,p_customer:'c',p_product:null,p_combo:null});
});
