// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {OwnerCustomerSheet} from '../src/features/OwnerCustomerSheet';
afterEach(cleanup);
function fixture(fail=false){
  const calls=[],onLock=vi.fn();
  const records={products:[{id:'b20',name:'Bidón 20 litros',active:true,returnable:true},{id:'b12',name:'Bidón 12 litros',active:true,returnable:true}],inventory_customer_containers:[{product_id:'b20',quantity:2}],inventory_operations:[],dispensers:[{id:'available',name:'Frío calor',serial:'FC-1',ownership:'company',location:'depot',customer_id:null,monthly:0},{id:'private',name:'Equipo particular',serial:'P-1',ownership:'customer',location:'customer',customer_id:'client-a',mode:'customer_owned',monthly:0},{id:'other',name:'Equipo de otro cliente',ownership:'company',location:'customer',customer_id:'client-b',monthly:0}]};
  const client={rpc:vi.fn(async()=>({data:'ok',error:null})),from:vi.fn(table=>{
    const call={table,filters:[]};calls.push(call);const chain={select:()=>chain,eq:(key,value)=>{call.filters.push([key,value]);return chain;},order:()=>chain,limit:()=>chain,then:(resolve,reject)=>Promise.resolve({data:records[table],error:fail?{message:'Sin conexión'}:null}).then(resolve,reject)};return chain;
  })};
  render(<OwnerCustomerSheet client={client} tenantId="tenant-a" customer={{id:'client-a',name:'Cliente de prueba',address:'Calle 123',phone:'123'}} onClose={vi.fn()} onEdit={vi.fn()} onLock={onLock}/>);
  return {client,calls};
}
it('consulta la ficha por empresa y cliente y separa equipos propios del cliente',async()=>{
  const {calls}=fixture();await screen.findByText('2 para devolver');
  expect(screen.getByText('Equipo particular')).toBeTruthy();
  expect(screen.queryByText('Equipo de otro cliente')).toBeNull();
  expect(screen.getByText(/Propiedad del cliente/)).toBeTruthy();
  expect(calls.every(c=>c.filters.some(([key,value])=>key==='tenant_id'&&value==='tenant-a'))).toBe(true);
  for(const table of ['inventory_customer_containers','inventory_operations'])expect(calls.find(c=>c.table===table).filters).toContainEqual(['customer_id','client-a']);
});
it('registra envases anteriores del cliente en una sola apertura con varios artículos',async()=>{
  const {client}=fixture();await screen.findByText('2 para devolver');
  fireEvent.click(screen.getByText('Registrar bidones que ya tiene'));
  fireEvent.change(screen.getByLabelText('Envases iniciales de Bidón 20 litros'),{target:{value:'4'}});
  fireEvent.change(screen.getByLabelText('Envases iniciales de Bidón 12 litros'),{target:{value:'2'}});
  fireEvent.click(screen.getByText('Guardar envases iniciales'));
  await screen.findByText('Envases iniciales registrados en este cliente.');
  expect(client.rpc).toHaveBeenCalledWith('inventory_owner_stock',expect.objectContaining({p_tenant:'tenant-a',p_kind:'opening_customer',p_customer:'client-a',p_items:[{product_id:'b20',quantity:4},{product_id:'b12',quantity:2}]}));
});
it('asigna un dispenser del depósito conservando su identificación y el alquiler',async()=>{
  const {client}=fixture();await screen.findByText('2 para devolver');
  fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(screen.queryByRole('option',{name:/Equipo de otro cliente/})).toBeNull();
  fireEvent.change(screen.getByLabelText('Dispenser disponible'),{target:{value:'available'}});
  fireEvent.change(screen.getByLabelText('Modalidad del dispenser'),{target:{value:'rental'}});
  fireEvent.change(screen.getByLabelText('Cuota mensual ($)'),{target:{value:'12500'}});
  fireEvent.click(screen.getByText('Guardar dispenser del cliente'));
  await screen.findByText('Dispenser asignado al cliente.');
  expect(client.rpc).toHaveBeenCalledWith('inventory_save_dispenser',expect.objectContaining({p_id:'available',p_serial:'FC-1',p_ownership:'company',p_location:'customer',p_customer:'client-a',p_trip:null,p_mode:'rental',p_monthly:12500}));
});
it('un error de lectura no presenta los envases como cero ni habilita asignaciones',async()=>{
  const {client}=fixture(true);await screen.findByRole('alert');
  expect(screen.queryByText('No hay envases registrados en su poder.')).toBeNull();
  expect(screen.queryByRole('button',{name:'Registrar bidones que ya tiene'})).toBeNull();
  expect(client.rpc).not.toHaveBeenCalled();
});
