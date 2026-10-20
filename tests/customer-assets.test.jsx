// @vitest-environment jsdom
import React, {useState} from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {addAssetMovement,assetQuantity,exampleAssets} from '../src/domain/customerAssets';
import {CustomerPanel} from '../src/features/CustomerPanel';
afterEach(cleanup);
it('calcula el inventario físico sin confundirlo con ventas y no permite retirar más de lo registrado',()=>{
 const asset=exampleAssets('maria')[0];
 const delivered=addAssetMovement(asset,'delivered',2,'Dos adicionales');
 const collected=addAssetMovement(delivered,'collected',1,'Devolución');
 expect(assetQuantity(collected)).toBe(4);
 expect(asset.movements).toHaveLength(0);
 expect(()=>addAssetMovement(collected,'collected',5,'')).toThrow(/más unidades/);
 expect(()=>addAssetMovement(collected,'delivered',1.5,'')).toThrow();
});
function Fixture(){
 const [customer,setCustomer]=useState({id:'x',name:'Cliente de prueba',address:'Casa 1',phone:'',days:'Lun',quantity:2,assets:[]});
 return <CustomerPanel customer={customer} state={{customers:[customer],order:['x'],deliveries:[]}} canManage onClose={()=>{}} onEdit={()=>{}} onToggleActive={()=>{}} onSave={assets=>{setCustomer(c=>({...c,assets}));return true;}}/>;
}
it('registra dos bases y un retiro; conserva el historial y actualiza el resumen sin generar deudas',()=>{
 render(<Fixture/>);
 fireEvent.click(screen.getByRole('tab',{name:'Envases y equipos'}));
 fireEvent.click(screen.getByText('Agregar elemento'));
 fireEvent.change(screen.getByLabelText('Descripción del elemento'),{target:{value:'Base cocina'}});
 fireEvent.change(screen.getByLabelText('Tipo de elemento'),{target:{value:'base'}});
 fireEvent.change(screen.getByLabelText('Cantidad que ya tiene'),{target:{value:'2'}});
 fireEvent.click(screen.getByText('Guardar elemento'));
 fireEvent.click(screen.getByText('Entregar / retirar Base cocina'));
 fireEvent.change(screen.getByLabelText('Movimiento'),{target:{value:'collected'}});
 fireEvent.change(screen.getByLabelText('Cantidad'),{target:{value:'3'}});
 fireEvent.submit(screen.getByText('Guardar movimiento').closest('form'));
 expect(screen.getByRole('alert').textContent).toContain('más unidades');
 fireEvent.change(screen.getByLabelText('Cantidad'),{target:{value:'1'}});
 fireEvent.click(screen.getByText('Guardar movimiento'));
 expect(screen.getByText('Retirado')).toBeTruthy();
 expect(screen.getByText('Registro inicial')).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Resumen'}));
 expect(within(screen.getByText('Bases para bidones').closest('article')).getByText('1')).toBeTruthy();
 expect(within(screen.getByText('Saldo pendiente demo').closest('article')).getByText(/0,00/)).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Historial de ventas'}));
 expect(screen.getByText('Todavía no hay ventas registradas en esta demo.')).toBeTruthy();
});
