// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CustomerContactFields,CustomerContactDetails,readContactPatch} from '../src/features/CustomerContactFields';
import {CustomerAccountEntries} from '../src/features/CustomerAccountEntries';
import {selectedAddressText} from '../src/domain/addressSearch';
import {matchesCustomer} from '../src/domain/customerSearch';
afterEach(cleanup);
it('guarda hasta seis teléfonos y permite retirar uno sin dejar el valor anterior',()=>{
 render(<form><CustomerContactFields initial={{phone:'111',phone2:'222',phone3:'333',delivery_notes:'Timbre B'}}/></form>);
 expect(screen.getByRole('button',{name:'Agregar otro número'})).toBeTruthy();
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
 fireEvent.change(screen.getByLabelText('Descripción del movimiento (opcional)'),{target:{value:'Bidones anteriores'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar nueva deuda'}));
 await screen.findByRole('button',{name:'Reintentar mismo movimiento de cuenta'});
 fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo movimiento de cuenta'}));
 await waitFor(()=>expect(saved).toHaveBeenCalled());expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
 expect(client.rpc.mock.calls[0][1]).toMatchObject({p_amount:1200,p_customer:'c',p_product:null,p_combo:null});
});

it('al quitar un contacto conserva unido nombre y numero del siguiente',()=>{
 render(<form><CustomerContactFields initial={{phone:'111',phone2:'222',phone2_name:'Ana',phone3:'333',phone3_name:'Luis'}}/></form>);fireEvent.click(screen.getByText('Quitar número 2'));expect(screen.getByLabelText('Teléfono 2').value).toBe('333');expect(screen.getByLabelText('Nombre del contacto 2').value).toBe('Luis');const patch=readContactPatch(new FormData(document.querySelector('form')),{phone2:'222',phone2_name:'Ana',phone3:'333',phone3_name:'Luis'});expect(patch).toEqual({phone2:'333',phone3:'',phone2_name:'Luis',phone3_name:''});
});
it('agregar otro numero permite nombrarlo y la planilla identifica a la persona',()=>{
 const view=render(<form><CustomerContactFields initial={{phone:'111'}}/></form>);fireEvent.click(screen.getByText('Agregar otro número'));fireEvent.change(screen.getByLabelText('Teléfono 2'),{target:{value:'222'}});fireEvent.change(screen.getByLabelText('Nombre del contacto 2'),{target:{value:'Ana, hija'}});expect(readContactPatch(new FormData(document.querySelector('form')))).toMatchObject({phone2:'222',phone2_name:'Ana, hija'});view.unmount();render(<CustomerContactDetails customer={{phone:'111',phone2:'222',phone2_name:'Ana, hija'}}/>);expect(screen.getByRole('link',{name:'Ana, hija · 222'}).getAttribute('href')).toBe('tel:222');
});

it('agrega hasta seis contactos, los conserva al quitar uno y no exige los restantes',()=>{
 render(<form><CustomerContactFields initial={{phone:'111'}}/></form>);
 for(let i=2;i<=6;i++){fireEvent.click(screen.getByRole('button',{name:'Agregar otro número'}));fireEvent.change(screen.getByLabelText(`Teléfono ${i}`),{target:{value:String(i).repeat(3)}});fireEvent.change(screen.getByLabelText(`Nombre del contacto ${i}`),{target:{value:`Persona ${i}`}});}
 expect(screen.queryByRole('button',{name:'Agregar otro número'})).toBeNull();
 const patch=readContactPatch(new FormData(document.querySelector('form')));expect(patch).toMatchObject({phone6:'666',phone6_name:'Persona 6'});
 fireEvent.click(screen.getByRole('button',{name:'Quitar número 4'}));expect(screen.getByLabelText('Teléfono 4').value).toBe('555');expect(screen.getByLabelText('Nombre del contacto 4').value).toBe('Persona 5');
});

it('permite deuda sin descripcion y conserva una referencia generica',async()=>{
 const client={rpc:vi.fn(async(n,a)=>({data:a.p_id,error:null}))};render(<CustomerAccountEntries client={client} tenantId="t" customerId="c" total={0} disabled={false} onLock={()=>{}} onSaved={()=>{}}/>);fireEvent.click(screen.getByText('Agregar deuda'));fireEvent.change(screen.getByLabelText('Importe de la deuda ($)'),{target:{value:'7000'}});expect(screen.getByLabelText(/Descripci.n del movimiento/).required).toBe(false);fireEvent.click(screen.getByText('Guardar nueva deuda'));await waitFor(()=>expect(client.rpc).toHaveBeenCalled());expect(client.rpc.mock.calls[0][1].p_note).toBe('Deuda registrada sin observaciones');
});
