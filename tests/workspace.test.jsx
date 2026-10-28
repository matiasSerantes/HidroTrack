// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OwnerWorkspace } from '../src/features/OwnerWorkspace';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function clientFixture({ role = 'owner', license = { kind: 'permanent', status: 'active', expires_at: null }, members = true, balances = [], balanceError = null } = {}) {
  const calls = [];
  const records = [{ id: 'customer-a', name: 'María', address: 'Calle 123', phone: '' }];
  const client = {
    rpc: vi.fn(async(name,args)=>name==='owner_remove_customer'?{data:args.p_customer,error:null}:{data:null,error:{message:'Sin respuesta de la conexión'}}),
    auth: { getUser:vi.fn(async()=>({data:{user:{id:'user-a',email:'self@example.test'}},error:null})),signOut: vi.fn(async () => ({ error: null })) },
    from: vi.fn(table => {
      const call = { table, filters: [], operation: 'read' }; calls.push(call);
      const chain = {
        select: () => chain,
        eq: (key, value) => { call.filters.push([key, value]); return chain; },
        order: () => chain,
        limit: () => chain,
        range: () => chain,
        insert: value => { call.operation = 'insert'; call.value = value; return chain; },
        update: value => { call.operation = 'update'; call.value = value; return chain; },
        single: () => {call.single=true;return chain;},
        maybeSingle: () => {call.single=true;return chain;},
        then: (resolve, reject) => {
          const data = table === 'tenant_members' ? (members ? [{ tenant_id: 'tenant-a', user_id:'user-a', role }] : []) : table === 'licenses' ? license : table === 'tenants' ? { name: 'Reparto A' } : table==='user_profiles' ? call.single ? {user_id:'user-a',full_name:'Jefe de prueba'} : [{user_id:'user-a',full_name:'Jefe de prueba'}] : table==='products' ? [{id:'product-a',name:'Bidón 20',unit:'unidad',returnable:true,active:true,price:3500}] : call.operation === 'insert' ? { id: 'new', ...call.value } : call.operation === 'update' ? { ...records[0], ...call.value } : table==='customers' ? [...records] : table==='customer_sale_balances'?balances:[];
          return Promise.resolve({ data, error: table==='customer_sale_balances'?balanceError:null }).then(resolve, reject);
        },
      };
      return chain;
    }),
  };
  return { client, calls };
}
describe('panel conectado del titular', () => {
  it('guarda el punto exacto del cliente en su empresa y lo muestra en planilla',async()=>{
    const {client,calls}=clientFixture();render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación rápida móvil'})).getByRole('button',{name:'Ver clientes'}));
    fireEvent.click(screen.getByRole('button',{name:'Planilla'}));await screen.findByText('Bidones y envases que tiene');
    fireEvent.click(screen.getByRole('button',{name:'Editar datos'}));
    expect(screen.getByRole('button',{name:'Ubicar en el mapa'})).toBeTruthy();expect(screen.getByRole('button',{name:'Usar posición actual'})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Latitud'),{target:{value:'-34.61'}});fireEvent.change(screen.getByLabelText('Longitud'),{target:{value:'-58.38'}});
    fireEvent.click(screen.getByText('Guardar cliente'));
    await waitFor(()=>expect(calls.find(c=>c.operation==='update')?.value).toMatchObject({latitude:-34.61,longitude:-58.38}));
    expect(calls.find(c=>c.operation==='update').filters).toEqual([['tenant_id','tenant-a'],['id','customer-a']]);
    await screen.findByRole('button',{name:'Planilla'});fireEvent.click(screen.getByRole('button',{name:'Planilla'}));
    expect(await screen.findByRole('link',{name:'Ver ubicación exacta en el mapa'})).toBeTruthy();
  });
  it('abre edición con los datos existentes y actualiza solo el cliente de la empresa',async()=>{
    const {client,calls}=clientFixture();render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');
    fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación rápida móvil'})).getByRole('button',{name:'Ver clientes'}));
    expect(screen.queryByRole('button',{name:'Eliminar cliente'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Planilla'}));
    await screen.findByText('Bidones y envases que tiene');
    fireEvent.click(screen.getByRole('button',{name:'Editar datos'}));
    expect(screen.getByLabelText('Nombre completo').value).toBe('María');
    expect(screen.getByLabelText('Dirección').value).toBe('Calle 123');
    fireEvent.change(screen.getByLabelText('Nombre completo'),{target:{value:'María actualizada'}});
    fireEvent.click(screen.getByText('Guardar cliente'));
    await screen.findByText('María actualizada');
    const update=calls.find(c=>c.operation==='update');
    expect(update.filters).toEqual([['tenant_id','tenant-a'],['id','customer-a']]);
    expect(update.value).toEqual({name:'María actualizada',address:'Calle 123',phone:''});
    expect(calls.some(c=>c.operation==='insert')).toBe(false);
  });
  it('abre la ficha desde la lista y bloquea la navegación ante una apertura incierta',async()=>{
    const {client}=clientFixture();render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación rápida móvil'})).getByRole('button',{name:'Ver clientes'}));
    fireEvent.click(screen.getByRole('button',{name:'Planilla'}));
    await screen.findByText('Bidones y envases que tiene');
    fireEvent.click(screen.getByRole('button',{name:'Registrar bidones que ya tiene'}));
    fireEvent.change(screen.getByLabelText('Envases iniciales de Bidón 20'),{target:{value:'3'}});
    fireEvent.click(screen.getByText('Guardar envases iniciales'));
    await screen.findByText('Reintentar misma operación');
    expect(screen.getByRole('button',{name:'Volver a clientes'}).disabled).toBe(true);
    expect(screen.getByRole('button',{name:'Eliminar cliente'}).disabled).toBe(true);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Ver catálogo'}).disabled).toBe(true));
    client.rpc.mockResolvedValue({data:'ok',error:null});
    fireEvent.click(screen.getByText('Reintentar misma operación'));
    await screen.findByText('Envases asignados desde el depósito. El total propio no cambió.');
    expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
  });
  it('ofrece inicio, menú lateral y navegación móvil con las secciones conectadas',async()=>{
    const {client}=clientFixture();render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');
    expect(screen.getByRole('heading',{name:'Mi jornada'})).toBeTruthy();
    const menu=screen.getByRole('navigation',{name:'Secciones del jefe'});
    fireEvent.click(screen.getByRole('button',{name:'Abrir navegación'}));
    expect(screen.getByRole('button',{name:'Abrir navegación'}).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(menu).getByRole('button',{name:'Catálogo',exact:true}));
    await screen.findByRole('button',{name:'Agregar producto'});
    expect(within(menu).queryByRole('button',{name:'Dispenser',exact:true})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Agregar producto'}));
    await screen.findByRole('button',{name:'Guardar artículo'});
    expect(screen.getByRole('heading',{name:'Catálogo'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'Abrir navegación'}).getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(within(menu).getByRole('button',{name:'Repartos y camión'}));
    await screen.findByRole('heading',{name:'1. Preparar reparto'});
    const mobile=screen.getByRole('navigation',{name:'Navegación rápida móvil'});
    fireEvent.click(within(mobile).getByRole('button',{name:'Ver clientes'}));
    expect(screen.getByRole('heading',{name:'Clientes de tu reparto'})).toBeTruthy();
    expect(screen.queryByText(/Elena Duarte/)).toBeNull();
  });
  it('bloquea ambos menús ante un movimiento incierto y conserva el ID al reintentar',async()=>{
    const {client}=clientFixture();render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');
    const menu=screen.getByRole('navigation',{name:'Secciones del jefe'});
    fireEvent.click(within(menu).getByRole('button',{name:'Stock'}));
    await screen.findByText('Dónde están los artículos');
    fireEvent.change(screen.getByLabelText('Cantidad de Bidón 20'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar stock'));
    await screen.findByText('Reintentar misma operación');
    await waitFor(()=>expect(within(menu).getByRole('button',{name:'Clientes'}).disabled).toBe(true));
    expect(screen.getByRole('button',{name:'Ver clientes'}).disabled).toBe(true);
    client.rpc.mockResolvedValue({data:'ok',error:null});
    fireEvent.click(screen.getByText('Reintentar misma operación'));
    await screen.findByText(/Inventario registrado/);
    await waitFor(()=>expect(within(menu).getByRole('button',{name:'Clientes'}).disabled).toBe(false));
    expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
  });
  it('abre el inventario real del jefe solo después de validar acceso y licencia', async()=>{
    const {client,calls}=clientFixture();
    render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');
    expect(screen.getByText('Jefe de prueba · Jefe de reparto')).toBeTruthy();
    expect(calls.some(c=>c.table==='inventory_owned_stock')).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Stock'}));
    await screen.findByText('Dónde están los artículos');
    expect(calls.find(c=>c.table==='inventory_owned_stock').filters).toContainEqual(['tenant_id','tenant-a']);
  });
  it('no consulta información comercial para un chofer', async () => {
    const { client, calls } = clientFixture({ role: 'driver' });
    render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByRole('heading',{name:'Tu espacio de asistente'});
    await screen.findByText('Correo: self@example.test');
    expect(calls.map(call => call.table)).toEqual(['tenant_members','user_profiles']);
    expect(calls.find(c=>c.table==='user_profiles').filters).toEqual([['user_id','user-a']]);
  });
  it('muestra el alta pendiente sin autoconceder un rol', async () => {
    const { client, calls } = clientFixture({ members: false });
    render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByRole('heading',{name:'Tu espacio de asistente'});
    expect(calls.every(call => call.operation === 'read')).toBe(true);
  });
  it.each([
    [{ kind: 'permanent', status: 'suspended', expires_at: null }, /está suspendida/],
    [{ kind: 'monthly', status: 'active', expires_at: '2000-01-01T00:00:00Z' }, /venció/],
  ])('no consulta clientes con licencia bloqueada', async (license, message) => {
    const { client, calls } = clientFixture({ license });
    render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText(message);
    expect(calls.some(call => call.table === 'customers')).toBe(false);
  });
  it('guarda y archiva clientes con filtros del tenant; archivar conserva el registro', async () => {
    const { client, calls } = clientFixture();
    render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');
    expect(calls.find(call => call.table === 'customers').filters).toContainEqual(['tenant_id', 'tenant-a']);
    fireEvent.click(screen.getByText('Nuevo cliente'));
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Mitre 100' } });
    fireEvent.click(screen.getByText('Guardar cliente'));
    await screen.findByText('Ana');
    expect(calls.find(call => call.operation === 'insert').value).toEqual({ tenant_id: 'tenant-a', name: 'Ana', address: 'Mitre 100', phone: '' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(screen.queryByRole('button',{name:'Eliminar cliente'})).toBeNull();
    fireEvent.click(screen.getAllByText('Planilla')[1]);
    await screen.findByText('Bidones y envases que tiene');
    fireEvent.click(screen.getByRole('button',{name:'Eliminar cliente'}));
    await waitFor(() => expect(screen.queryByText('María')).toBeNull());
    expect(client.rpc).toHaveBeenCalledWith('owner_remove_customer',{p_tenant:'tenant-a',p_customer:'customer-a'});
  });
});

it('muestra deuda directamente y permite buscar sin acentos y por direccion',async()=>{
 const {client}=clientFixture({balances:[{id:'s1',customer_id:'customer-a',balance:3000},{id:'s2',customer_id:'customer-a',balance:1800}]});render(<OwnerWorkspace client={client} userId="user-a"/>);
 await screen.findByText('María');fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación rápida móvil'})).getByRole('button',{name:'Ver clientes'}));
 expect(await screen.findByText(/Debe.*4.800,00/)).toBeTruthy();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'maria 123'}});expect(screen.getByRole('button',{name:'Planilla'})).toBeTruthy();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'nadie'}});expect(screen.getByText(/No hay coincidencias/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Limpiar búsqueda'}));expect(screen.getByRole('button',{name:'Planilla'})).toBeTruthy();
});
it('un error de saldos no indica que el cliente no debe',async()=>{
 const {client}=clientFixture({balanceError:{message:'offline'}});render(<OwnerWorkspace client={client} userId="user-a"/>);await screen.findByText('María');fireEvent.click(within(screen.getByRole('navigation',{name:'Navegación rápida móvil'})).getByRole('button',{name:'Ver clientes'}));await screen.findByText('Saldo sin verificar');expect(screen.queryByText('Sin deuda pendiente')).toBeNull();
});
