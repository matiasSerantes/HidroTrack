// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {OwnerFillingCosts,OwnerLoadHistory} from '../src/features/OwnerFillingCosts';
afterEach(cleanup);
const products=[{id:'water',name:'Agua',active:true,returnable:true,family:'article'},{id:'machine',name:'Frio calor',active:true,returnable:false,family:'dispenser'}];
it('configura costo separado del precio solo de retornables y permite desactivar sin borrarlo',()=>{
 const onSubmit=vi.fn();render(<OwnerFillingCosts tenantId="a" products={products} settings={{enabled:true,costs:[{product_id:'water',unit_cost:125}]}} locked={false} onSubmit={onSubmit}/>);
 expect(screen.queryByText('Registrar costo de Frio calor')).toBe(null);
 fireEvent.click(screen.getByLabelText('Controlar costo de llenado'));
 fireEvent.click(screen.getByRole('button',{name:'Guardar configuración de llenado'}));
 expect(onSubmit.mock.calls[0][0].args).toEqual({p_tenant:'a',p_enabled:false,p_costs:[{product_id:'water',unit_cost:125}]});
});
it('historial conserva nombres y no presenta control desactivado como costo cero conocido',()=>{
 render(<OwnerLoadHistory snapshots={[{id:'x',trip_name:'Ruta de ayer',occurred_on:'2026-10-23',cost_enabled:false,filling_total:0,items:[{product_id:'p',name:'Nombre historico',suggested:3,loaded:4,extra:1,missing:0,refilled:2,unit_cost:null,filling_cost:null}]}]}/>);
 expect(screen.getByText('Nombre historico')).toBeTruthy();expect(screen.getByText('Esta carga se confirmó sin control de costo de llenado.')).toBeTruthy();expect(screen.getByText(/Cargados: 4/)).toBeTruthy();
});
