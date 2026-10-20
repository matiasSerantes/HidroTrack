// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminWorkspace } from '../src/features/AdminWorkspace';
import { AccountWorkspace } from '../src/features/AccountWorkspace';
afterEach(cleanup);

it('guarda la licencia solo para la empresa seleccionada y vuelve a consultar el directorio', async () => {
 const tenant = { id: 'tenant-a', name: 'Empresa A', license: { kind: 'permanent', status: 'active', expires_at: null, driver_limit: 2 }, members: [] };
 const chain = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(async()=>({data:{tenant_id:'tenant-a'},error:null})) };
 chain.update.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.select.mockReturnValue(chain);
 const client = { rpc: vi.fn(async()=>({data:[tenant],error:null})), from: vi.fn(()=>chain) };
 render(<AdminWorkspace client={client}/>);
 const card = (await screen.findByRole('heading', { name: 'Empresa A' })).closest('article');
 fireEvent.click(within(card).getByRole('button', { name: 'Editar licencia' }));
 fireEvent.change(within(card).getByLabelText('Estado'), { target: { value: 'suspended' } });
 fireEvent.click(within(card).getByRole('button', { name: 'Guardar licencia' }));
 await screen.findByText('Licencia actualizada.');
 expect(client.from).toHaveBeenCalledWith('licenses');
 expect(chain.eq).toHaveBeenCalledWith('tenant_id','tenant-a');
 expect(chain.update).toHaveBeenCalledWith({kind:'permanent',status:'suspended',expires_at:null,driver_limit:2});
 expect(client.rpc.mock.calls.filter(([name])=>name==='admin_directory').length).toBe(2);
});

it('impide mostrar el panel si falla la verificación del rol', async () => {
 const client = { rpc: vi.fn(async () => ({ error: new Error('offline') })), auth: { signOut: vi.fn() } };
 render(<AccountWorkspace client={client} userId="user"/>);
 await screen.findByRole('alert');
 expect(screen.queryByText('Nueva sodería')).toBeNull();
 expect(client.rpc).toHaveBeenCalledWith('is_platform_admin');
});

it('crea una sodería usando la función segura y limpia la contraseña al completar', async () => {
 const client = { rpc: vi.fn(async () => ({ data: [], error: null })), functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) } };
 render(<AdminWorkspace client={client}/>);
 await screen.findByText('Todavía no hay soderías. Creá la primera para comenzar.');
 fireEvent.click(screen.getByText('Nueva sodería'));
 fireEvent.change(screen.getByLabelText('Nombre de la sodería'), { target: { value: 'Sodería Norte' } });
 fireEvent.change(screen.getByLabelText('Correo del titular'), { target: { value: 'owner@example.test' } });
 fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'test-password-123' } });
 fireEvent.click(screen.getByText('Confirmar alta'));
 await waitFor(() => expect(client.functions.invoke).toHaveBeenCalledWith('admin-users', { body: expect.objectContaining({ role: 'owner', name: 'Sodería Norte', email: 'owner@example.test', password: 'test-password-123', kind: 'permanent', expires_at: null, driver_limit: 0 }) }));
 await screen.findByText(/Alta completada/);
 expect(screen.queryByLabelText('Contraseña inicial')).toBeNull();
});

it('muestra el error del servidor sin anunciar un alta exitosa', async () => {
 const client = { rpc: vi.fn(async () => ({ data: [], error: null })), functions: { invoke: vi.fn(async () => ({ error: { context: { json: async () => ({ error: 'Correo registrado' }) } } })) } };
 render(<AdminWorkspace client={client}/>);
 await screen.findByText('Todavía no hay soderías. Creá la primera para comenzar.');
 fireEvent.click(screen.getByText('Nueva sodería'));
 fireEvent.submit(screen.getByText('Confirmar alta').closest('form'));
 await screen.findByText('Correo registrado');
 expect(screen.queryByText(/Alta completada/)).toBeNull();
});
