// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {CustomerContainerCorrection} from '../src/features/CustomerContainerCorrection';
import {movementClock} from '../src/domain/deviceClock';
afterEach(cleanup);
it('correccion de combo muestra totales de cada articulo, no infiere cantidad de promos',()=>{
 const onSubmit=vi.fn(),onComboSubmit=vi.fn();render(<CustomerContainerCorrection products={[{id:'a',name:'Bidón 12',active:true,returnable:true},{id:'b',name:'Bidón 20',active:true,returnable:true}]} held={[{product_id:'a',quantity:3},{product_id:'b',quantity:1}]} combos={[{id:'mix',name:'Promo mixta',version:2,active:true,price:100,available:0,items:[{product_id:'a',quantity:2},{product_id:'b',quantity:1}]}]} disabled={false} onSubmit={onSubmit} onComboSubmit={onComboSubmit}/>);
 fireEvent.click(screen.getByText('Corregir cantidad de bidones'));fireEvent.change(screen.getByLabelText('Artículo a corregir'),{target:{value:'combo:mix'}});
 expect(screen.getByLabelText('Total correcto de Bidón 12').value).toBe('3');expect(screen.getByLabelText('Total correcto de Bidón 20').value).toBe('1');fireEvent.change(screen.getByLabelText('Total correcto de Bidón 12'),{target:{value:'4'}});fireEvent.change(screen.getByLabelText('Motivo de la corrección'),{target:{value:'Conteo anterior'}});fireEvent.click(screen.getByText('Guardar cantidad correcta'));
 expect(onSubmit).not.toHaveBeenCalled();expect(onComboSubmit).toHaveBeenCalledWith(expect.objectContaining({items:[{product_id:'a',expected:3,quantity:4},{product_id:'b',expected:1,quantity:1}]}));
});
it('muestra segundos en zona capturada y no inventa reloj de dispositivo para datos viejos',()=>{
 expect(movementClock({created_at:'2026-11-07T17:00:00Z',device_recorded_at:'2026-11-07T13:11:12.345Z',device_time_zone:'America/Argentina/Buenos_Aires'})).toContain('10:11:12');expect(movementClock({created_at:'2026-11-07T17:00:00Z'})).toMatch(/^Registro del servidor:/);
});
