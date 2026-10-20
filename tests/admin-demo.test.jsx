// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdminWorkspace } from '../src/features/AdminWorkspace';
import { DemoAccess } from '../src/features/DemoAccess';
afterEach(() => { cleanup(); localStorage.clear(); });
it('muestra ejemplos y crea una sodería sin consultar Supabase ni guardar contraseñas', async () => {
 const client = { rpc: vi.fn(), functions: { invoke: vi.fn() } };
 render(<AdminWorkspace demo client={client}/>);
 await screen.findByText('Sodería del Norte');
 fireEvent.click(screen.getByText('Nueva sodería'));
 fireEvent.change(screen.getByLabelText('Nombre de la sodería'), { target: { value: 'Soda Demo Nueva' } });
 fireEvent.change(screen.getByLabelText('Correo del titular'), { target: { value: 'nuevo@example.com' } });
 fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'password-no-guardar' } });
 fireEvent.click(screen.getByText('Confirmar alta'));
 await screen.findByText('Soda Demo Nueva');
 expect(client.rpc).not.toHaveBeenCalled();
 expect(client.functions.invoke).not.toHaveBeenCalled();
 expect(localStorage.getItem('hidrotrack.admin-demo.v1')).not.toContain('password-no-guardar');
 cleanup();
 render(<AdminWorkspace demo/>);
 await screen.findByText('Soda Demo Nueva');
});
it('permite elegir perfil, valida credenciales ficticias y simula recuperar contraseña', () => {
 const onLogin = vi.fn();
 render(<DemoAccess onLogin={onLogin} onExit={() => {}}/>);
 expect(screen.getByLabelText('Perfil de demostración').value).toBe('owner');
 fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } });
 fireEvent.click(screen.getByText('Ingresar a la demo'));
 expect(onLogin).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Perfil de demostración'), { target: { value: 'admin' } });
 fireEvent.click(screen.getByText('Ingresar a la demo'));
 expect(onLogin).toHaveBeenCalledWith('admin');
 fireEvent.click(screen.getByText('Olvidé mi contraseña'));
 fireEvent.click(screen.getByText('Simular recuperación'));
 expect(screen.getByRole('status').textContent).toContain('No se envió ningún mensaje');
});
