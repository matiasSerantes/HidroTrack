// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {DepotCountsEditor} from '../src/features/DepotCountsEditor';
import {setDemoDepotCounts} from '../src/domain/depotCountsDemo';
import {seedProgram} from '../src/domain/programDemo';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('envía saldos esperados y conteo de ambos estados con confirmación',()=>{
 const submit=vi.fn();vi.stubGlobal('confirm',()=>true);render(<DepotCountsEditor tenantId="t" product={{id:'p',name:'Bidón',returnable:true,family:'article'}} ready={552} empty={0} locked={false} onSubmit={submit}/>);
 fireEvent.click(screen.getByText('Editar llenos y vacíos'));expect(screen.getByLabelText('Llenos en depósito').value).toBe('552');
 fireEvent.change(screen.getByLabelText('Llenos en depósito'),{target:{value:'400'}});fireEvent.change(screen.getByLabelText('Vacíos en depósito'),{target:{value:'152'}});expect(screen.getByRole('status').textContent).toContain('Se conserva el total');
 fireEvent.click(screen.getByText('Guardar llenos y vacíos'));expect(submit).toHaveBeenCalledWith(expect.objectContaining({name:'inventory_set_depot_counts',args:expect.objectContaining({p_expected_ready:552,p_expected_empty:0,p_ready:400,p_empty:152})}));
});
it('cancelar confirmación y saldos inválidos no envían cambios',()=>{
 const submit=vi.fn();vi.stubGlobal('confirm',()=>false);render(<DepotCountsEditor tenantId="t" product={{id:'p',name:'Agua',returnable:true}} ready={2} empty={5} locked={false} onSubmit={submit}/>);
 const input=screen.getByLabelText('Llenos en depósito');fireEvent.change(input,{target:{value:'3'}});fireEvent.submit(input.closest('form'));expect(submit).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:'-1'}});fireEvent.submit(input.closest('form'));expect(submit).not.toHaveBeenCalled();expect(screen.getByRole('alert').textContent).toContain('Revisá');
});
it('demo conserva clientes y camiones, y prohíbe al asistente modificar el depósito',()=>{
 const state=seedProgram(),product=state.products.find(p=>p.returnable&&p.kind==='sale');const empty=state.depotEmpties[product.id]||0;
 const next=setDemoDepotCounts(state,'owner',product.id,product.depot,empty,product.depot-1,empty+1);
 expect(next.clients).toEqual(state.clients);expect(next.trips).toEqual(state.trips);expect(next.products.find(p=>p.id===product.id).depot).toBe(product.depot-1);expect(next.depotEmpties[product.id]).toBe(empty+1);
 expect(()=>setDemoDepotCounts(state,'luz',product.id,product.depot,empty,1,2)).toThrow(/Solo el jefe/);
});
