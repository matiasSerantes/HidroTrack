// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OwnerWorkspace } from '../src/features/OwnerWorkspace';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function clientFixture({ role = 'owner', license = { kind: 'permanent', status: 'active', expires_at: null }, members = true } = {}) {
  const calls = [];
  const records = [{ id: 'customer-a', name: 'María', address: 'Calle 123', phone: '' }];
  const client = {
    rpc: vi.fn(async()=>({data:null,error:{message:'Sin respuesta de la conexión'}})),
    auth: { signOut: vi.fn(async () => ({ error: null })) },
    from: vi.fn(table => {
      const call = { table, filters: [], operation: 'read' }; calls.push(call);
      const chain = {
        select: () => chain,
        eq: (key, value) => { call.filters.push([key, value]); return chain; },
        order: () => chain,
        limit: () => chain,
        insert: value => { call.operation = 'insert'; call.value = value; return chain; },
        update: value => { call.operation = 'update'; call.value = value; return chain; },
        single: () => chain,
        maybeSingle: () => {call.single=true;return chain;},
        then: (resolve, reject) => {
          const data = table === 'tenant_members' ? (members ? [{ tenant_id: 'tenant-a', user_id:'user-a', role }] : []) : table === 'licenses' ? license : table === 'tenants' ? { name: 'Reparto A' } : table==='user_profiles' ? call.single ? {full_name:'Jefe de prueba'} : [{user_id:'user-a',full_name:'Jefe de prueba'}] : table==='products' ? [{id:'product-a',name:'Bidón 20',unit:'unidad',returnable:true,active:true,price:3500}] : call.operation === 'insert' ? { id: 'new', ...call.value } : call.operation === 'update' ? { id: 'customer-a' } : table==='customers' ? [...records] : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return chain;
    }),
  };
  return { client, calls };
}
describe('panel conectado del titular', () => {
  it('ofrece inicio, menú lateral y navegación móvil con las secciones conectadas',async()=>{
    const {client}=clientFixture();render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText('María');
    expect(screen.getByRole('heading',{name:'Mi jornada'})).toBeTruthy();
    const menu=screen.getByRole('navigation',{name:'Secciones del jefe'});
    fireEvent.click(screen.getByRole('button',{name:'Abrir navegación'}));
    expect(screen.getByRole('button',{name:'Abrir navegación'}).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(menu).getByRole('button',{name:'Catálogo',exact:true}));
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
    fireEvent.change(screen.getByLabelText('Artículo'),{target:{value:'product-a'}});
    fireEvent.change(screen.getByLabelText('Cantidad'),{target:{value:'2'}});
    fireEvent.click(screen.getByText('Registrar movimiento'));
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
    await screen.findByText(/Tu cuenta es de chofer/);
    expect(calls.map(call => call.table)).toEqual(['tenant_members']);
  });
  it('muestra el alta pendiente sin autoconceder un rol', async () => {
    const { client, calls } = clientFixture({ members: false });
    render(<OwnerWorkspace client={client} userId="user-a"/>);
    await screen.findByText(/todavía no está asignada/);
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
    fireEvent.click(screen.getAllByText('Archivar')[1]);
    await waitFor(() => expect(screen.queryByText('María')).toBeNull());
    const update = calls.find(call => call.operation === 'update');
    expect(update.value).toEqual({ active: false });
    expect(update.filters).toEqual([['tenant_id', 'tenant-a'], ['id', 'customer-a']]);
  });
});
