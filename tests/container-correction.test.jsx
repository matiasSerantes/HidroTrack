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
 fireEvent.change(screen.getByLabelText('Observación de la corrección (opcional)'),{target:{value:'Conteo equivocado'}});
 fireEvent.click(screen.getByText('Guardar cantidad correcta'));
 expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({expected:2,quantity:4,source:'depot_empty'}));
 fireEvent.change(screen.getByLabelText('Total correcto en poder del cliente'),{target:{value:'0'}});
 fireEvent.click(screen.getByText('Guardar cantidad correcta'));
 expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({expected:2,quantity:0}));
});

it('agrega bidon de 20 aun cuando el cliente solo tiene de 12 y no exige observacion',()=>{
 const onSubmit=vi.fn();render(<CustomerContainerCorrection products={[{id:'b12',name:'Bidon 12 litros',returnable:true,active:true},{id:'b20',name:'Bidon 20 litros',returnable:true,active:true}]} held={[{product_id:'b12',quantity:2}]} disabled={false} onSubmit={onSubmit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Agregar Bidon 20 litros'}));expect(screen.getByLabelText('Articulo a corregir'.replace('Articulo','Artículo')).value).toBe('b20');
 expect(screen.getByLabelText('Total correcto en poder del cliente').value).toBe('0');fireEvent.change(screen.getByLabelText('Total correcto en poder del cliente'),{target:{value:'3'}});fireEvent.click(screen.getByText('Guardar cantidad correcta'));
 expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({product:'b20',expected:0,quantity:3,source:'depot_empty',note:'Correccion desde planilla (sin observaciones)'}));
 fireEvent.click(screen.getByRole('button',{name:'Corregir Bidon 12 litros'}));expect(screen.getByLabelText('Total correcto en poder del cliente').value).toBe('2');
});

it('selecciona llenos si ese articulo no tiene vacios y muestra ambos saldos',()=>{
 const onSubmit=vi.fn();render(<CustomerContainerCorrection balances={[{product_id:'b20',depot_ready:5,depot_empty:0}]} products={[{id:'b20',name:'Bidon 20',returnable:true,active:true}]} held={[]} disabled={false} onSubmit={onSubmit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Agregar Bidon 20'}));expect(screen.getByLabelText('Deposito para la diferencia'.replace('Deposito','Depósito')).value).toBe('depot_ready');expect(screen.getByRole('option',{name:/5 disponibles/})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Total correcto en poder del cliente'),{target:{value:'2'}});fireEvent.click(screen.getByText('Guardar cantidad correcta'));expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({source:'depot_ready',quantity:2,expected:0}));
});
