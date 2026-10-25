// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {OwnerCustomerSheet} from '../src/features/OwnerCustomerSheet';
afterEach(cleanup);
function fixture(fail=false,{model=false,unavailable=false,noIndividual=false}={}){
  const calls=[],onLock=vi.fn();
  const records={products:[{id:'b20',name:'Bidón 20 litros',active:true,returnable:true},{id:'b12',name:'Bidón 12 litros',active:true,returnable:true}],inventory_customer_containers:[{product_id:'b20',quantity:2}],inventory_operations:[],dispensers:[{id:'available',name:'Frío calor',serial:'FC-1',ownership:'company',location:'depot',customer_id:null,monthly:0},{id:'private',name:'Equipo particular',serial:'P-1',ownership:'customer',location:'customer',customer_id:'client-a',mode:'customer_owned',monthly:0},{id:'other',name:'Equipo de otro cliente',ownership:'company',location:'customer',customer_id:'client-b',monthly:0}]};
  records.inventory_owned_stock=model?[{product_id:'model',depot_ready:unavailable?0:2}]:[];
  records.inventory_truck_stock=[];records.inventory_trips=[];records.dispenser_assignments=[];
  if(model)records.products.push({id:'model',name:'Dispenser básico',family:'dispenser',active:true,returnable:false});
  if(unavailable)records.dispensers.push({id:'broken',name:'Dispenser roto',serial:'R-1',ownership:'company',location:'depot',retired:true});
  if(noIndividual)records.dispensers=records.dispensers.filter(a=>a.id!=='available');
  const client={rpc:vi.fn(async()=>({data:'ok',error:null})),from:vi.fn(table=>{
    const call={table,filters:[]};calls.push(call);const chain={select:()=>chain,eq:(key,value)=>{call.filters.push([key,value]);return chain;},order:()=>chain,limit:()=>chain,then:(resolve,reject)=>Promise.resolve({data:records[table],error:fail?{message:'Sin conexión'}:null}).then(resolve,reject)};return chain;
  })};
  render(<OwnerCustomerSheet client={client} tenantId="tenant-a" customer={{id:'client-a',name:'Cliente de prueba',address:'Calle 123',phone:'123'}} onClose={vi.fn()} onEdit={vi.fn()} onLock={onLock}/>);
  return {client,calls,records,setFailure:value=>{fail=value;}};
}
it('explica catálogo sin unidades y registra existencias antes de permitir asignar, sin duplicarlas',async()=>{
  const {client,records}=fixture(false,{model:true,unavailable:true,noIndividual:true});await screen.findByText('No hay unidades de dispenser disponibles para asignar.');
  fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(screen.getByLabelText('Dispenser disponible').disabled).toBe(true);expect(screen.getByRole('button',{name:'Guardar dispenser del cliente'}).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Registrar unidades de dispenser'}));
  fireEvent.change(screen.getByLabelText('Unidades que aún no registraste'),{target:{value:'3'}});
  client.rpc.mockImplementation(async(name)=>{
    if(name==='inventory_record_stock')records.inventory_owned_stock[0].depot_ready=3;
    if(name==='inventory_assign_dispenser_model')records.inventory_owned_stock[0].depot_ready=2;
    return {data:'ok',error:null};
  });
  fireEvent.click(screen.getByRole('button',{name:'Registrar unidades existentes'}));
  await screen.findByText('Unidades de dispenser registradas. Ahora elegí Asignar dispenser para dejar una en este cliente.');
  expect(client.rpc).toHaveBeenCalledWith('inventory_record_stock',expect.objectContaining({p_tenant:'tenant-a',p_kind:'receive',p_trip:null,p_customer:null,p_items:[{product_id:'model',quantity:3}]}));
  fireEvent.click(screen.getByText('Asignar dispenser'));expect(screen.getByRole('option',{name:'Dispenser básico · 3 disponibles en depósito'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Dispenser disponible'),{target:{value:'model:model:depot'}});fireEvent.click(screen.getByText('Guardar dispenser del cliente'));
  await screen.findByText('Dispenser asignado desde stock. Ya no figura disponible.');
  expect(client.rpc.mock.calls.filter(([name])=>name==='inventory_record_stock')).toHaveLength(1);
  expect(records.inventory_owned_stock[0].depot_ready).toBe(2);
});
it('actualiza una ficha abierta cuando el stock se cargó desde otra pantalla',async()=>{
  const {client,records}=fixture(false,{model:true,unavailable:true,noIndividual:true});await screen.findByText('No hay unidades de dispenser disponibles para asignar.');
  records.inventory_owned_stock[0].depot_ready=4;
  fireEvent.click(screen.getByRole('button',{name:'Actualizar disponibilidad'}));await waitFor(()=>expect(screen.getByText('Asignar dispenser').disabled).toBe(false));fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(await screen.findByRole('option',{name:'Dispenser básico · 4 disponibles en depósito'})).toBeTruthy();expect(client.rpc).not.toHaveBeenCalled();
});
it('abrir asignación vuelve a consultar el stock sin pedir otra carga',async()=>{
  const {client,records}=fixture(false,{model:true,unavailable:true,noIndividual:true});await screen.findByText('No hay unidades de dispenser disponibles para asignar.');
  records.inventory_owned_stock[0].depot_ready=5;fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(await screen.findByRole('option',{name:'Dispenser básico · 5 disponibles en depósito'})).toBeTruthy();expect(client.rpc).not.toHaveBeenCalled();
});
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
  const {client,calls}=fixture(true);await screen.findByRole('alert');
  expect(calls.some(c=>c.table==='customer_product_preferences')).toBe(false);
  expect(screen.queryByText('No hay envases registrados en su poder.')).toBeNull();
  expect(screen.queryByRole('button',{name:'Registrar bidones que ya tiene'})).toBeNull();
  expect(client.rpc).not.toHaveBeenCalled();
});
it('permite recuperar la ficha despues de un error antes de habilitar las cantidades',async()=>{
  const {setFailure}=fixture(true);await screen.findByRole('alert');
  expect(screen.queryByText('2 para devolver')).toBeNull();setFailure(false);
  fireEvent.click(screen.getByRole('button',{name:'Actualizar ficha'}));
  await screen.findByText('2 para devolver');
  expect(screen.queryByText('No pudimos cargar la ficha. Revisá la conexión e intentá nuevamente.')).toBeNull();
  expect(screen.getByRole('button',{name:'Registrar bidones que ya tiene'}).disabled).toBe(false);
});
it('el modelo con stock aparece disponible y asignarlo consume una unidad sin volver a registrar el equipo',async()=>{
  const {client,records}=fixture(false,{model:true});await screen.findByText('2 para devolver');
  fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(screen.getByRole('option',{name:'Dispenser básico · 2 disponibles en depósito'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Dispenser disponible'),{target:{value:'model:model:depot'}});
  client.rpc.mockImplementation(async()=>{
    records.inventory_owned_stock[0].depot_ready=1;
    records.dispenser_assignments.push({id:'assignment',product_id:'model',customer_id:'client-a',mode:'loan',monthly:0,status:'active',occurred_on:'2026-10-19'});
    return {data:'assignment',error:null};
  });
  fireEvent.click(screen.getByText('Guardar dispenser del cliente'));
  await screen.findByText('Dispenser asignado desde stock. Ya no figura disponible.');
  expect(client.rpc).toHaveBeenCalledWith('inventory_assign_dispenser_model',expect.objectContaining({p_product:'model',p_customer:'client-a',p_mode:'loan',p_monthly:0,p_trip:null}));
  expect(client.rpc).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button',{name:'Registrar devolución'})).toBeTruthy();
  fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(screen.getByRole('option',{name:'Dispenser básico · 1 disponibles en depósito'})).toBeTruthy();
});
it('devolver el modelo desde la planilla lo libera y retira la asignación activa',async()=>{
  const {client,records}=fixture(false,{model:true});
  records.dispenser_assignments.push({id:'assignment',product_id:'model',customer_id:'client-a',mode:'loan',monthly:0,status:'active',occurred_on:'2026-10-18'});
  await screen.findByRole('button',{name:'Registrar devolución'});
  client.rpc.mockImplementation(async()=>{records.dispenser_assignments[0].status='returned';return {data:'ok',error:null};});
  fireEvent.click(screen.getByRole('button',{name:'Registrar devolución'}));
  await screen.findByText('Devolución registrada. El dispenser vuelve a estar disponible en depósito.');
  expect(client.rpc).toHaveBeenCalledWith('inventory_return_dispenser_model',expect.objectContaining({p_assignment:'assignment',p_tenant:'tenant-a'}));
  expect(screen.queryByRole('button',{name:'Registrar devolución'})).toBeNull();
});
it('no ofrece modelos sin disponibilidad ni equipos retirados por rotura',async()=>{
  fixture(false,{model:true,unavailable:true});await screen.findByText('2 para devolver');
  fireEvent.click(screen.getByText('Asignar dispenser'));
  expect(screen.queryByRole('option',{name:/Dispenser básico/})).toBeNull();
  expect(screen.queryByRole('option',{name:/Dispenser roto/})).toBeNull();
  expect(screen.getByRole('option',{name:'Frío calor · FC-1'})).toBeTruthy();
});
