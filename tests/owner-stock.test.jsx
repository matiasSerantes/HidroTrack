// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerStock } from '../src/features/OwnerStock';
afterEach(()=>cleanup());
function fixture() {
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
  render(<OwnerStock client={client} tenantId="tenant-a" customers={[{id:'c1',name:'María'}]}/>);
  return {client,filters};
}
describe('inventario conectado del jefe',()=>{
  it('prepara clientes del reparto y confirma su carga única usando las RPC',async()=>{
    const {client}=fixture(); await screen.findByText('Dónde están los artículos');
    fireEvent.click(screen.getByText('Preparar reparto y cargar camión'));
    fireEvent.change(screen.getByLabelText('Nombre del reparto'),{target:{value:'Ruta propia'}});
    fireEvent.change(screen.getByLabelText('Repartidor asignado'),{target:{value:'owner'}});
    fireEvent.click(screen.getByLabelText('María'));
    fireEvent.click(screen.getByText('Guardar reparto'));
    await screen.findByText(/Reparto preparado/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_create_trip',expect.objectContaining({p_tenant:'tenant-a',p_driver:'owner',p_customers:['c1'],p_name:'Ruta propia'}));
    fireEvent.change(screen.getByLabelText('Reparto para cargar'),{target:{value:'t1'}});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 20'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Confirmar carga del camión'));
    await screen.findByText(/Carga única confirmada/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_post',expect.objectContaining({p_kind:'load',p_trip:'t1',p_customer:null,p_items:[{product_id:'b20',quantity:2}]}));
  });
  it('consulta saldos por empresa y registra recarga con la función real, sin comprar envases',async()=>{
    const {client,filters}=fixture(); await screen.findByText('Dónde están los artículos');
    expect(filters.every(([,key,value])=>key!=='tenant_id'||value==='tenant-a')).toBe(true);
    expect(screen.getByText('Propiedad del cliente')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Movimiento'),{target:{value:'refill'}});
    fireEvent.change(screen.getByLabelText('Artículo'),{target:{value:'b20'}});
    fireEvent.change(screen.getByLabelText('Cantidad'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar movimiento'));
    await screen.findByText(/Recarga registrada:/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_owner_stock',expect.objectContaining({p_tenant:'tenant-a',p_kind:'refill',p_customer:null,p_items:[{product_id:'b20',quantity:2}]}));
    expect(screen.getByLabelText('Cantidad').value).toBe('');
  });
  it('un corte de conexión conserva el mismo identificador al reintentar',async()=>{
    const {client}=fixture(); await screen.findByText('Dónde están los artículos');
    client.rpc.mockResolvedValueOnce({error:{message:'Sin respuesta'}}).mockResolvedValueOnce({error:null,data:'ok'});
    fireEvent.change(screen.getByLabelText('Artículo'),{target:{value:'b20'}});
    fireEvent.change(screen.getByLabelText('Cantidad'),{target:{value:'4'}});
    fireEvent.click(screen.getByText('Registrar movimiento'));
    await screen.findByText('Reintentar misma operación');
    expect(screen.getByLabelText('Cantidad').closest('fieldset').disabled).toBe(true);
    fireEvent.click(screen.getByText('Reintentar misma operación'));
    await screen.findByText(/Inventario registrado/);
    expect(client.rpc.mock.calls[1]).toEqual(client.rpc.mock.calls[0]);
  });
  it('registra un surtidor del cliente sin alquiler ni ingreso al patrimonio propio',async()=>{
    const {client}=fixture(); await screen.findByText('Dónde están los artículos');
    fireEvent.click(screen.getByText('Registrar o ubicar surtidor'));
    fireEvent.change(screen.getByLabelText('Nombre o modelo'),{target:{value:'Surtidor particular'}});
    fireEvent.change(screen.getByLabelText('Propiedad'),{target:{value:'customer'}});
    fireEvent.change(screen.getByLabelText('Cliente del surtidor'),{target:{value:'c1'}});
    expect(screen.queryByLabelText('Alquiler mensual ($)')).toBeNull();
    fireEvent.click(screen.getByText('Guardar ubicación del surtidor'));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('inventory_save_dispenser',expect.objectContaining({p_ownership:'customer',p_location:'customer',p_customer:'c1',p_monthly:0,p_mode:'customer_owned'})));
  });
});
