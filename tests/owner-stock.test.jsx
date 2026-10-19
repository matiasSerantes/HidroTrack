// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerStock } from '../src/features/OwnerStock';
afterEach(()=>cleanup());
function fixture(section) {
  const filters=[];
  const records={
    products:[{id:'b20',name:'Bidón 20',unit:'unidad',price:3500,returnable:true,active:true}],
    inventory_owned_stock:[{product_id:'b20',total_owned:20,depot_ready:10,depot_empty:5,truck_ready:2,truck_empty:0,in_customers:3}],
    dispensers:[{id:'asset',name:'Básico',serial:'B-1',ownership:'company',location:'customer',customer_id:'c1',mode:'loan',monthly:0},{id:'own',name:'Equipo de María',serial:'',ownership:'customer',location:'customer',customer_id:'c1',mode:'customer_owned',monthly:0}],
    inventory_customer_containers:[{customer_id:'c1',product_id:'b20',quantity:3}],inventory_trips:[{id:'t1',name:'Mañana',status:'planned'}],inventory_operations:[],tenant_members:[{user_id:'owner',role:'owner'}],inventory_truck_stock:[],
  };
  const client={rpc:vi.fn(async()=>({data:'ok',error:null})),from:vi.fn(table=>{
    const chain={select:()=>chain,eq:(key,value)=>{filters.push([table,key,value]);return chain;},order:()=>chain,limit:()=>chain,then:(resolve,reject)=>Promise.resolve({data:records[table]||[],error:null}).then(resolve,reject)};return chain;
  })};
  render(<OwnerStock section={section} client={client} tenantId="tenant-a" customers={[{id:'c1',name:'María'}]}/>);
  return {client,filters,records};
}
describe('inventario conectado del jefe',()=>{
  it('carga varios artículos juntos y retira el formulario al confirmar el reparto',async()=>{
    const {client,records}=fixture('trips');
    records.products.push({id:'b4',name:'Bidón 4 litros',unit:'unidad',price:1000,returnable:true,active:true},{id:'dispenser',name:'Surtidor básico',unit:'unidad',price:0,returnable:false,active:true});
    records.inventory_owned_stock.push({product_id:'b4',depot_ready:20},{product_id:'dispenser',depot_ready:4});
    await screen.findByRole('heading',{name:'Carga de camión'});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 20'),{target:{value:'6'}});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 4 litros'),{target:{value:'12'}});
    fireEvent.change(screen.getByLabelText('Cargar Surtidor básico'),{target:{value:'2'}});
    expect(screen.getByText('20 unidades')).toBeTruthy();
    client.rpc.mockImplementation(async()=>{records.inventory_trips[0].status='active';return {data:'ok',error:null};});
    fireEvent.click(screen.getByText('Registrar carga'));
    await screen.findByText(/Carga única confirmada/);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('inventory_post',expect.objectContaining({p_kind:'load',p_trip:'t1',p_items:[{product_id:'b20',quantity:6},{product_id:'b4',quantity:12},{product_id:'dispenser',quantity:2}]}));
    expect(screen.queryByRole('button',{name:'Registrar carga'})).toBeNull();
    expect(screen.getByText(/No hay repartos pendientes de carga/)).toBeTruthy();
  });
  it('registra inventario de varios artículos en una sola operación y rechaza listas vacías',async()=>{
    const {client,records}=fixture();
    records.products.push({id:'b4',name:'Bidón 4 litros',unit:'unidad',price:1000,returnable:true,active:true});
    await screen.findByLabelText('Cantidad de Bidón 4 litros');
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText('Ingresá la cantidad de al menos un artículo.');
    expect(client.rpc).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'600'}});
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 4 litros'),{target:{value:'80'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText(/Inventario registrado/);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('inventory_owner_stock',expect.objectContaining({p_kind:'receive_empty',p_items:[{product_id:'b20',quantity:600},{product_id:'b4',quantity:80}]}));
  });
  it('registra 600 bidones iniciales como vacíos y separa el detalle del camión',async()=>{
    const {client}=fixture(); await screen.findByText('Dónde están los artículos');
    expect(screen.getByLabelText('Movimiento').value).toBe('receive_empty');
    expect(screen.queryByRole('columnheader',{name:'Camión llenos'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Preparar reparto y cargar camión'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Agregar artículo al catálogo'})).toBeNull();
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'600'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText(/Inventario registrado/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_owner_stock',expect.objectContaining({p_kind:'receive_empty',p_items:[{product_id:'b20',quantity:600}]}));
  });
  it('presenta artículos y precios en catálogo sin mezclar formularios de stock o reparto',async()=>{
    fixture('catalog'); await screen.findByText('Lo que vende tu reparto');
    expect(screen.getByRole('heading',{name:'Bidón 20'})).toBeTruthy();
    expect(screen.getByText(/20 unidades registradas/)).toBeTruthy();
    expect(screen.getByLabelText('Unidad de venta (no cantidad)').value).toBe('unidad');
    expect(screen.queryByLabelText('Movimiento')).toBeNull();
    expect(screen.queryByRole('heading',{name:'Camión y repartos'})).toBeNull();
    expect(screen.getByRole('button',{name:'Agregar artículo al catálogo'}).className).toBe('primary');
  });
  it('prepara clientes del reparto y confirma su carga única usando las RPC',async()=>{
    const {client}=fixture('trips'); await screen.findByText('1. Preparar reparto');
    fireEvent.change(screen.getByLabelText('Nombre del reparto'),{target:{value:'Ruta propia'}});
    fireEvent.change(screen.getByLabelText('Repartidor asignado'),{target:{value:'owner'}});
    fireEvent.click(screen.getByLabelText('María'));
    fireEvent.click(screen.getByText('Guardar reparto'));
    await screen.findByText(/Reparto preparado/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_create_trip',expect.objectContaining({p_tenant:'tenant-a',p_driver:'owner',p_customers:['c1'],p_name:'Ruta propia'}));
    fireEvent.change(screen.getByLabelText('Reparto para cargar'),{target:{value:'t1'}});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 20'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar carga'));
    await screen.findByText(/Carga única confirmada/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_post',expect.objectContaining({p_kind:'load',p_trip:'t1',p_customer:null,p_items:[{product_id:'b20',quantity:2}]}));
  });
  it('consulta saldos por empresa y registra recarga con la función real, sin comprar envases',async()=>{
    const {client,filters}=fixture(); await screen.findByText('Dónde están los artículos');
    expect(filters.every(([,key,value])=>key!=='tenant_id'||value==='tenant-a')).toBe(true);
    expect(screen.queryByText('Registrar o ubicar surtidor')).toBeNull();
    fireEvent.change(screen.getByLabelText('Movimiento'),{target:{value:'refill'}});
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText(/Recarga registrada:/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_owner_stock',expect.objectContaining({p_tenant:'tenant-a',p_kind:'refill',p_customer:null,p_items:[{product_id:'b20',quantity:2}]}));
    expect(screen.getByLabelText('Cantidad de Bidón 20').value).toBe('0');
  });
  it('un corte de conexión conserva el mismo identificador al reintentar',async()=>{
    const {client}=fixture(); await screen.findByText('Dónde están los artículos');
    client.rpc.mockResolvedValueOnce({error:{message:'Sin respuesta'}}).mockResolvedValueOnce({error:null,data:'ok'});
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'4'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText('Reintentar misma operación');
    expect(screen.getByLabelText('Cantidad de Bidón 20').closest('fieldset').disabled).toBe(true);
    fireEvent.click(screen.getByText('Reintentar misma operación'));
    await screen.findByText(/Inventario registrado/);
    expect(client.rpc.mock.calls[1]).toEqual(client.rpc.mock.calls[0]);
  });
  it('registra un surtidor del cliente sin alquiler ni ingreso al patrimonio propio',async()=>{
    const {client}=fixture('dispensers'); await screen.findByText('Propiedad del cliente');
    fireEvent.click(screen.getByText('Registrar o ubicar surtidor'));
    fireEvent.change(screen.getByLabelText('Nombre o modelo'),{target:{value:'Surtidor particular'}});
    fireEvent.change(screen.getByLabelText('Propiedad'),{target:{value:'customer'}});
    fireEvent.change(screen.getByLabelText('Cliente del surtidor'),{target:{value:'c1'}});
    expect(screen.queryByLabelText('Alquiler mensual ($)')).toBeNull();
    fireEvent.click(screen.getByText('Guardar ubicación del surtidor'));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('inventory_save_dispenser',expect.objectContaining({p_ownership:'customer',p_location:'customer',p_customer:'c1',p_monthly:0,p_mode:'customer_owned'})));
  });
});
