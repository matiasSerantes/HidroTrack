// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {CustomerContainerCorrection} from '../src/features/CustomerContainerCorrection';
afterEach(cleanup);
it('edita el total actual, admite cero y excluye dispenser',()=>{
 const onSubmit=vi.fn();render(<CustomerContainerCorrection products={[{id:'b',name:'Bidón',returnable:true,active:true},{id:'d',name:'Dispenser',family:'dispenser',returnable:true,active:true}]} held={[{product_id:'b',quantity:2}]} disabled={false} onSubmit={onSubmit}/>);
 fireEvent.click(screen.getByText('Corregir cantidad de bidones'));
 expect(screen.queryByRole('option',{name:'Dispenser'})).toBeNull();
 expect(screen.getByLabelText('Total correcto en poder del cliente').value).toBe('2');
 fireEvent.change(screen.getByLabelText('Total correcto en poder del cliente'),{target:{value:'4'}});
 fireEvent.change(screen.getByLabelText('Motivo de la corrección'),{target:{value:'Conteo equivocado'}});
 fireEvent.click(screen.getByText('Guardar cantidad correcta'));
 expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({expected:2,quantity:4,source:'depot_empty'}));
 fireEvent.change(screen.getByLabelText('Total correcto en poder del cliente'),{target:{value:'0'}});
 fireEvent.click(screen.getByText('Guardar cantidad correcta'));
 expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({expected:2,quantity:0}));
});
