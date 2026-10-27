// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerStock } from '../src/features/OwnerStock';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function fixture(section,{legacy=false}={}) {
  const filters=[];
  const records={
    products:[{id:'b20',name:'Bidón 20',unit:'unidad',price:3500,returnable:true,active:true}],
    inventory_owned_stock:[{product_id:'b20',total_owned:20,depot_ready:10,depot_empty:5,truck_ready:2,truck_empty:0,in_customers:3}],
    dispensers:[{id:'asset',name:'Básico',serial:'B-1',ownership:'company',location:'customer',customer_id:'c1',mode:'loan',monthly:0},{id:'own',name:'Equipo de María',serial:'',ownership:'customer',location:'customer',customer_id:'c1',mode:'customer_owned',monthly:0}],
    inventory_customer_containers:[{customer_id:'c1',product_id:'b20',quantity:3}],inventory_trips:[{id:'t1',name:'Mañana',status:'planned'}],inventory_operations:[],tenant_members:[{user_id:'owner',role:'owner'}],inventory_truck_stock:[],
  };
  const client={rpc:vi.fn(async(name,args)=>{if(['owner_trip_invitations','owner_assistant_close_inbox','owner_my_trips','customer_proposal_inbox','owner_followup_inbox'].includes(name))return {data:[],error:null};if(name==='catalog_archive_item'){const p=records.products.find(p=>p.id===args.p_product);if(p)p.active=false;}if(name==='inventory_writeoff_dispenser'){const a=records.dispensers.find(a=>a.id===args.p_asset);if(a)a.retired=true;}return {data:'ok',error:null};}),from:vi.fn(table=>{
    let patch=null,target='',probe=false;const chain={select:(columns)=>{probe=columns==='occurred_on';return chain;},update:value=>{patch=value;return chain;},single:()=>chain,eq:(key,value)=>{filters.push([table,key,value]);if(key==='id')target=value;return chain;},order:()=>chain,limit:()=>chain,range:()=>chain,then:(resolve,reject)=>{if(patch){const product=records.products.find(p=>p.id===target);Object.assign(product,patch);}return Promise.resolve({data:patch?{id:target}:records[table]||[],count:(records[table]||[]).length,error:legacy&&probe?{code:'42703',message:'Missing column'}:null}).then(resolve,reject);}};return chain;
  })};
  const rendered=render(<OwnerStock section={section} client={client} tenantId="tenant-a" customers={[{id:'c1',name:'María'}]}/>);
  return {client,filters,records,rendered};
}
describe('inventario conectado del jefe',()=>{
  it('alta de dispenser registra la cantidad inicial como stock en una sola operación',async()=>{
    const {client}=fixture('catalog');await screen.findByRole('button',{name:'Agregar dispenser'});
    fireEvent.click(screen.getByRole('button',{name:'Agregar dispenser'}));
    fireEvent.change(screen.getByLabelText('Nombre del artículo'),{target:{value:'Básico'}});
    expect(screen.getByLabelText('Unidad de venta (no cantidad)').readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText('Cantidad inicial en stock'),{target:{value:'5'}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar artículo'}));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('catalog_create_stocked_item',expect.objectContaining({p_quantity:5,p_unit:'unidad',p_family:'dispenser',p_empty:false})));
    expect(client.rpc).toHaveBeenCalledTimes(1);
    await screen.findByText('Artículo y stock inicial registrados. Las unidades disponibles ya se pueden cargar o asignar.');
  });
  it('crea un dispenser con categoría explícita y muestra retiro al final',async()=>{
    const {client}=fixture('catalog');await screen.findByRole('button',{name:'Agregar dispenser'});
    const buttons=screen.getByRole('button',{name:'Agregar dispenser'}).parentElement;
    expect(buttons.children[0].textContent).toBe('Agregar dispenser');expect(buttons.children[1].textContent).toBe('Agregar producto');
    fireEvent.click(screen.getByRole('button',{name:'Agregar dispenser'}));
    fireEvent.change(screen.getByLabelText('Nombre del artículo'),{target:{value:'Básico'}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar artículo'}));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('catalog_create_item',expect.objectContaining({p_family:'dispenser',p_name:'Básico',p_returnable:false})));
    const sections=document.querySelectorAll('.owner-stock>section');
    expect(sections[sections.length-1].querySelector('h3').textContent).toBe('Retirar producto o dispenser');
  });
  it('elimina un alta equivocada cuando todas las unidades están en depósito',async()=>{
    const {client,records}=fixture('catalog');records.inventory_owned_stock=[{product_id:'b20',total_owned:12,depot_ready:5,depot_empty:7,truck_ready:0,truck_empty:0,in_customers:0}];
    await screen.findByRole('button',{name:'Eliminar Bidón 20'});vi.spyOn(window,'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button',{name:'Eliminar Bidón 20'}));
    await screen.findByText(/Artículo eliminado de activos/);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('12 unidades'));
    expect(client.rpc).toHaveBeenCalledWith('catalog_archive_item',expect.objectContaining({p_product:'b20',p_note:expect.stringContaining('Corrección de alta')}));
    expect(records.products[0].active).toBe(false);
  });
  it('elimina un equipo identificado mal ingresado en depósito sin fingir rotura',async()=>{
    const {client,records}=fixture('catalog');records.dispensers[0].location='depot';records.dispensers[0].customer_id=null;
    await screen.findByRole('button',{name:'Eliminar dispenser identificado Básico'});vi.spyOn(window,'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button',{name:'Eliminar dispenser identificado Básico'}));
    await screen.findByText(/Dispenser eliminado de activos/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_writeoff_dispenser',expect.objectContaining({p_asset:'asset',p_kind:'remove'}));
    expect(records.dispensers[0].retired).toBe(true);
  });
  it('elige vacíos o llenos al ingresar sin perder la cantidad escrita',async()=>{
    const {client}=fixture();await screen.findByLabelText('Cantidad de Bidón 20');
    expect(screen.getByRole('radio',{name:'Vacíos'}).checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'600'}});
    fireEvent.click(screen.getByRole('radio',{name:'Llenos'}));
    expect(screen.getByLabelText('Cantidad de Bidón 20').value).toBe('600');
    fireEvent.click(screen.getByText('Registrar stock'));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('inventory_record_stock',expect.objectContaining({p_kind:'receive',p_items:[{product_id:'b20',quantity:600}]})));
  });
  it('relleno y carga se envían juntos con identificadores estables al reintentar',async()=>{
    const consoleError=vi.spyOn(console,'error');
    const {client}=fixture('trips');await screen.findByRole('heading',{name:'Carga de camión'});
    expect(screen.getByLabelText('Cargar Bidón 20').max).toBe('10');
    fireEvent.click(screen.getByRole('checkbox',{name:/Rellenar los vacíos/}));
    expect(screen.getByLabelText('Cargar Bidón 20').max).toBe('15');
    fireEvent.change(screen.getByLabelText('Cargar Bidón 20'),{target:{value:'13'}});
    client.rpc.mockRejectedValueOnce(new Error('Sin respuesta'));
    fireEvent.click(screen.getByText('Registrar carga'));
    await screen.findByText('Reintentar misma operación');
    expect(client.rpc).toHaveBeenCalledWith('inventory_confirm_load',expect.objectContaining({p_trip:'t1',p_fill:true,p_items:[{product_id:'b20',quantity:13}],p_refill_id:expect.any(String),p_date:expect.any(String)}));
    const first=client.rpc.mock.calls.find(([name])=>name==='inventory_confirm_load');expect(first[1].p_id).not.toBe(first[1].p_refill_id);
    fireEvent.click(screen.getByText('Reintentar misma operación'));
    await screen.findByText(/Carga única confirmada/);expect(client.rpc.mock.calls.filter(([name])=>name==='inventory_confirm_load')[1]).toEqual(first);
    expect(consoleError.mock.calls.filter(args=>args.some(value=>String(value).includes('same key')))).toEqual([]);
  });
  it('elimina un bidón sin existencias de activos conservando su registro',async()=>{
    const {records,filters}=fixture('catalog');records.inventory_owned_stock=[];records.inventory_customer_containers=[];
    await screen.findByRole('button',{name:'Eliminar Bidón 20'});
    vi.spyOn(window,'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button',{name:'Eliminar Bidón 20'}));
    await screen.findByText('Artículo eliminado de activos. Sus registros e historial se conservan.');
    expect(records.products).toHaveLength(1);expect(records.products[0]).toMatchObject({id:'b20',active:false});
    expect(screen.queryByRole('heading',{name:'Bidón 20'})).toBeNull();
    expect(filters).toContainEqual(['inventory_owned_stock','product_id','b20']);
  });
  it('ofrece eliminar modelos dispenser y conserva el artículo al cancelar',async()=>{
    const {records}=fixture('dispensers');records.products.push({id:'model',name:'Dispenser básico',unit:'unidad',price:0,returnable:false,active:true});
    await screen.findByRole('button',{name:'Eliminar Dispenser básico'});
    vi.spyOn(window,'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button',{name:'Eliminar Dispenser básico'}));
    await waitFor(()=>expect(window.confirm).toHaveBeenCalled());
    expect(records.products.find(p=>p.id==='model').active).toBe(true);
  });
  it('no permite ocultar un artículo que todavía tiene unidades en stock o clientes',async()=>{
    const {records}=fixture();await screen.findByRole('button',{name:'Eliminar Bidón 20'});
    vi.spyOn(window,'confirm').mockReturnValue(true);
    vi.spyOn(window,'alert').mockImplementation(()=>{});
    fireEvent.click(screen.getByRole('button',{name:'Eliminar Bidón 20'}));
    await screen.findByText(/tiene 20 unidades registradas/);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('No se eliminó Bidón 20'));
    expect(window.confirm).not.toHaveBeenCalled();expect(records.products[0].active).toBe(true);
  });
  it('muestra productos y dispenser juntos sin duplicar ni convertir cantidades',async()=>{
    const {client,records,rendered}=fixture('catalog');
    records.products.push({id:'model',name:'Dispenser frío calor',unit:'5',price:2000,returnable:false,active:true});
    await screen.findByText('Inventario de productos y dispenser');
    expect(screen.getByRole('heading',{name:'Dispenser frío calor'})).toBeTruthy();
    rendered.rerender(<OwnerStock section="dispensers" client={client} tenantId="tenant-a" customers={[{id:'c1',name:'María'}]}/>);
    await screen.findByRole('heading',{name:'Dispenser frío calor'});
    expect(records.products).toHaveLength(2);expect(client.rpc).not.toHaveBeenCalled();
    expect(screen.getByText('0',{selector:'.stock-catalog-units'})).toBeTruthy();
  });
  it('edita nombre, unidad y precio conservando el identificador y las existencias',async()=>{
    const {records,filters}=fixture('catalog');await screen.findByRole('button',{name:'Editar Bidón 20'});
    fireEvent.click(screen.getByRole('button',{name:'Editar Bidón 20'}));
    expect(screen.getByLabelText('Nombre del artículo').value).toBe('Bidón 20');
    fireEvent.change(screen.getByLabelText('Precio de entrega ($)'),{target:{value:'4000'}});
    fireEvent.click(screen.getByText('Guardar artículo'));
    await screen.findByText(/Artículo actualizado/);
    expect(records.products[0].id).toBe('b20');expect(records.products[0].price).toBe(4000);
    expect(Number(records.inventory_owned_stock[0].total_owned)).toBe(20);
    expect(filters).toContainEqual(['products','id','b20']);
  });
  it('envía fecha, ubicación, cantidad y cliente involucrado al registrar una rotura',async()=>{
    const {client}=fixture();await screen.findByText('Retirar stock o registrar rotura');
    fireEvent.change(screen.getByLabelText('Artículo afectado'),{target:{value:'b20'}});
    fireEvent.change(screen.getByLabelText('Fecha del hecho'),{target:{value:'2026-10-18'}});
    fireEvent.change(screen.getByLabelText('Dónde estaba'),{target:{value:'customer_held'}});
    fireEvent.change(screen.getByLabelText('Cliente que tenía los envases'),{target:{value:'c1'}});
    fireEvent.change(screen.getByLabelText('A quién le ocurrió'),{target:{value:'customer'}});
    fireEvent.change(screen.getByLabelText('Persona involucrada'),{target:{value:'c1'}});
    fireEvent.change(screen.getByLabelText('Motivo / detalle'),{target:{value:'Se cayó'}});
    fireEvent.click(screen.getByText('Registrar rotura'));
    await screen.findByText(/Rotura registrada/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_remove',expect.objectContaining({p_kind:'damage',p_quantity:1,p_source:'customer_held',p_customer:'c1',p_involved_kind:'customer',p_involved_id:'c1',p_date:'2026-10-18'}));
  });
  it('en la base anterior conserva las entradas existentes y no simula guardar roturas',async()=>{
    const {client}=fixture(undefined,{legacy:true});await screen.findByText('Dónde están los artículos');
    expect(screen.getByLabelText('Fecha de carga').disabled).toBe(true);
    expect(screen.getByText('Registrar rotura').closest('fieldset').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'1'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText(/Inventario registrado/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_owner_stock',expect.objectContaining({p_kind:'receive_empty'}));
  });
  it('carga varios artículos juntos y retira el formulario al confirmar el reparto',async()=>{
    const {client,records}=fixture('trips');
    records.products.push({id:'b4',name:'Bidón 4 litros',unit:'unidad',price:1000,returnable:true,active:true},{id:'dispenser',name:'Dispenser básico',unit:'unidad',price:0,returnable:false,active:true});
    records.inventory_owned_stock.push({product_id:'b4',depot_ready:20},{product_id:'dispenser',depot_ready:4});
    await screen.findByRole('heading',{name:'Carga de camión'});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 20'),{target:{value:'6'}});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 4 litros'),{target:{value:'12'}});
    fireEvent.change(screen.getByLabelText('Cargar Dispenser básico'),{target:{value:'2'}});
    expect(screen.getByText('20 unidades')).toBeTruthy();
    client.rpc.mockImplementation(async(name)=>{if(['owner_trip_invitations','owner_assistant_close_inbox','owner_my_trips','customer_proposal_inbox','owner_followup_inbox'].includes(name))return {data:[],error:null};records.inventory_trips[0].status='active';return {data:'ok',error:null};});
    fireEvent.click(screen.getByText('Registrar carga'));
    await screen.findByText(/Carga única confirmada/);
    expect(client.rpc.mock.calls.filter(([name])=>name==='inventory_confirm_load')).toHaveLength(1);
    expect(client.rpc).toHaveBeenCalledWith('inventory_confirm_load',expect.objectContaining({p_fill:false,p_trip:'t1',p_items:[{product_id:'b20',quantity:6},{product_id:'b4',quantity:12},{product_id:'dispenser',quantity:2}]}));
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
    expect(client.rpc).toHaveBeenCalledWith('inventory_record_stock',expect.objectContaining({p_kind:'receive_empty',p_items:[{product_id:'b20',quantity:600},{product_id:'b4',quantity:80}]}));
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
    expect(client.rpc).toHaveBeenCalledWith('inventory_record_stock',expect.objectContaining({p_kind:'receive_empty',p_items:[{product_id:'b20',quantity:600}]}));
  });
  it('ordena creación, inventario y retiro dentro del catálogo unificado',async()=>{
    fixture('catalog'); await screen.findByText('Inventario de productos y dispenser');
    expect(screen.getByRole('heading',{name:'Bidón 20'})).toBeTruthy();
    expect(screen.getByText(/17/,{selector:'.stock-catalog-units'})).toBeTruthy();expect(screen.getByText('Total propio: 20 unidades')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Agregar producto'}));expect(screen.getByLabelText('Unidad de venta (no cantidad)').value).toBe('unidad');
    expect(screen.getByLabelText('Movimiento')).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Camión y repartos'})).toBeNull();
    expect(screen.getByRole('button',{name:'Agregar dispenser'}).className).toBe('primary');expect(screen.getByRole('heading',{name:'Retirar producto o dispenser'})).toBeTruthy();
  });
  it('abre ajuste del articulo desde catalogo y registra la suma sin editar el producto',async()=>{
    const {client}=fixture('catalog');await screen.findByText('Inventario de productos y dispenser');
    fireEvent.click(screen.getByRole('button',{name:'Ajustar unidades de Bid\u00f3n 20'}));
    fireEvent.change(screen.getByLabelText('Unidades a sumar'),{target:{value:'3'}});
    fireEvent.change(screen.getByLabelText('Motivo del ajuste'),{target:{value:'Corregir carga inicial'}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar ajuste de unidades'}));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('inventory_record_stock',expect.objectContaining({p_kind:'receive_empty',p_items:[{product_id:'b20',quantity:3}],p_customer:null,p_trip:null})));
  });
  it('prepara clientes del reparto y confirma su carga única usando las RPC',async()=>{
    const {client}=fixture('trips'); await screen.findByText('1. Preparar reparto');
    fireEvent.change(screen.getByLabelText('Nombre del reparto'),{target:{value:'Ruta propia'}});
    fireEvent.change(screen.getByLabelText('Repartidor asignado'),{target:{value:'owner'}});
    fireEvent.click(screen.getByLabelText(/Mostrar tambi/));
    fireEvent.click(await screen.findByLabelText(/María/));
    fireEvent.click(screen.getByText('Guardar reparto'));
    await screen.findByText(/Reparto preparado/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_create_trip',expect.objectContaining({p_tenant:'tenant-a',p_driver:'owner',p_customers:['c1'],p_name:'Ruta propia'}));
    fireEvent.change(screen.getByLabelText('Reparto para cargar'),{target:{value:'t1'}});
    fireEvent.change(screen.getByLabelText('Cargar Bidón 20'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar carga'));
    await screen.findByText(/Carga única confirmada/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_confirm_load',expect.objectContaining({p_fill:false,p_trip:'t1',p_items:[{product_id:'b20',quantity:2}]}));
  });
  it('consulta saldos por empresa y registra recarga con la función real, sin comprar envases',async()=>{
    const {client,filters}=fixture(); await screen.findByText('Dónde están los artículos');
    expect(filters.every(([,key,value])=>key!=='tenant_id'||value==='tenant-a')).toBe(true);
    expect(screen.queryByText('Registrar o ubicar dispenser')).toBeNull();
    fireEvent.change(screen.getByLabelText('Movimiento'),{target:{value:'refill'}});
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText(/Recarga registrada:/);
    expect(client.rpc).toHaveBeenCalledWith('inventory_record_stock',expect.objectContaining({p_tenant:'tenant-a',p_kind:'refill',p_customer:null,p_items:[{product_id:'b20',quantity:2}]}));
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
  it('registra un dispenser del cliente sin alquiler ni ingreso al patrimonio propio',async()=>{
    const {client}=fixture('dispensers'); await screen.findByText('Propiedad del cliente');
    fireEvent.click(screen.getByText('Registrar o ubicar dispenser'));
    fireEvent.change(screen.getByLabelText('Nombre o modelo'),{target:{value:'Dispenser particular'}});
    fireEvent.change(screen.getByLabelText('Propiedad'),{target:{value:'customer'}});
    fireEvent.change(screen.getByLabelText('Cliente del dispenser'),{target:{value:'c1'}});
    expect(screen.queryByLabelText('Alquiler mensual ($)')).toBeNull();
    fireEvent.click(screen.getByText('Guardar ubicación del dispenser'));
    await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('inventory_save_dispenser',expect.objectContaining({p_ownership:'customer',p_location:'customer',p_customer:'c1',p_monthly:0,p_mode:'customer_owned'})));
  });
});

it('catalogo destaca 598 disponibles y conserva 600 totales con 2 en clientes',async()=>{const {records}=fixture('catalog');records.inventory_owned_stock=[{product_id:'b20',total_owned:600,depot_ready:0,depot_empty:598,truck_ready:0,truck_empty:0,in_customers:2}];expect(await screen.findByText(/598/,{selector:'.stock-catalog-units'})).toBeTruthy();expect(screen.getByText('Total propio: 600 unidades')).toBeTruthy();expect(screen.getByText(/Asignados a clientes/).textContent).toContain('2');});
