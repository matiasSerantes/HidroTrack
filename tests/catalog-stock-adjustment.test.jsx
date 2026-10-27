// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CatalogStockAdjustment} from '../src/features/CatalogStockAdjustment';
afterEach(cleanup);
const product={id:'p',name:'Bidón ficticio',returnable:true,family:'article'};
function setup(p=product){const submit=vi.fn();render(<CatalogStockAdjustment tenantId="t" product={p} ready={10} empty={20} ownerId="owner" locked={false} onSubmit={submit} onCancel={()=>{}}/>);fireEvent.change(screen.getByLabelText('Motivo del ajuste'),{target:{value:'Corrección de carga'}});return submit;}
it('suma vacios con fecha y motivo sin reemplazar el total ni asignaciones',()=>{
 const submit=setup();fireEvent.change(screen.getByLabelText('Unidades a sumar'),{target:{value:'5'}});expect(screen.getByText(/quedarán 25/)).toBeTruthy();fireEvent.click(screen.getByText('Guardar ajuste de unidades'));
 expect(submit).toHaveBeenCalledWith(expect.objectContaining({name:'inventory_record_stock',args:expect.objectContaining({p_kind:'receive_empty',p_trip:null,p_customer:null,p_items:[{product_id:'p',quantity:5}],p_note:'Ajuste desde catálogo: Corrección de carga'})}));
});
it('retira solo del estado elegido y rechaza cantidades superiores al saldo',()=>{
 const submit=setup();fireEvent.change(screen.getByLabelText('Ajuste de cantidad'),{target:{value:'remove'}});fireEvent.change(screen.getByLabelText('Estado de las unidades'),{target:{value:'depot_ready'}});const q=screen.getByLabelText('Unidades a retirar');fireEvent.change(q,{target:{value:'11'}});fireEvent.submit(q.closest('form'));expect(submit).not.toHaveBeenCalled();
 fireEvent.change(q,{target:{value:'2'}});fireEvent.submit(q.closest('form'));expect(submit).toHaveBeenCalledWith(expect.objectContaining({name:'inventory_remove',args:expect.objectContaining({p_quantity:2,p_source:'depot_ready',p_kind:'remove',p_involved_kind:'owner',p_involved_id:'owner',p_customer:null,p_trip:null})}));
});
it('dispenser se suma disponible y no como vacio',()=>{
 const submit=setup({...product,family:'dispenser'});expect(screen.queryByLabelText('Estado de las unidades')).toBeNull();fireEvent.change(screen.getByLabelText('Unidades a sumar'),{target:{value:'1'}});fireEvent.click(screen.getByText('Guardar ajuste de unidades'));expect(submit).toHaveBeenCalledWith(expect.objectContaining({args:expect.objectContaining({p_kind:'receive'})}));
});
