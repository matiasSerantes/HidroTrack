// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { seedProgram } from '../src/domain/programDemo';
import { JOURNEY_KEY } from '../src/domain/demoJourney';
import { App } from '../src/App';

const auth = vi.hoisted(() => ({
 getSession: vi.fn(),
 getUser: vi.fn(),
 updateUser: vi.fn(),
 onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth } }));
vi.mock('../src/features/AccountWorkspace', () => ({ AccountWorkspace: () => <main>Mi cuenta real</main> }));
vi.mock('../src/features/DemoProgram', () => ({ DemoProgram: ({ onExit }) => <main>Demostración<button onClick={onExit}>Salir de demo</button></main> }));

beforeEach(() => {
 window.history.replaceState(null, '', '/');
 auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
 auth.getUser.mockResolvedValue({data:{user:{id:'owner'}},error:null});
 auth.updateUser.mockResolvedValue({data:{user:{id:'owner'}},error:null});
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it('una jornada demo guardada no reemplaza el acceso real ni borra datos', async () => {
 const state = seedProgram();
 const journey = JSON.stringify({ actor: 'owner', page: 'overview', tripId: state.trips[0].id, dialog: null });
 localStorage.setItem(JOURNEY_KEY, journey);
 render(<App/>);
 expect(await screen.findByRole('heading', { name: 'Bienvenido a HidroTrack' })).toBeTruthy();
 expect(localStorage.getItem(JOURNEY_KEY)).toBe(journey);
 fireEvent.click(screen.getByRole('button', { name: /Explorar demostración/ }));
 expect(await screen.findByRole('button', { name: 'Salir de demo' })).toBeTruthy();
});

it('una cuenta autenticada entra al panel real aunque haya usado la demo', async () => {
 localStorage.setItem(JOURNEY_KEY, JSON.stringify({ actor: 'owner', page: 'overview' }));
 auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null });
 render(<App/>);
 expect(await screen.findByText('Mi cuenta real')).toBeTruthy();
});

it('salir de demo conserva el resto de la URL y recargar no la vuelve a abrir', async () => {
 window.history.replaceState({ marker: 'keep' }, '', '/?demo=1&origen=web#inicio');
 const view = render(<App/>);
 fireEvent.click(await screen.findByRole('button', { name: 'Salir de demo' }));
 await screen.findByRole('heading', { name: 'Bienvenido a HidroTrack' });
 expect(window.location.search).toBe('?origen=web');
 expect(window.location.hash).toBe('#inicio');
 expect(window.history.state).toEqual({ marker: 'keep' });
 view.unmount();
 render(<App/>);
 expect(await screen.findByRole('heading', { name: 'Bienvenido a HidroTrack' })).toBeTruthy();
});

it('recuperacion espera confirmacion y entra automaticamente a la cuenta',async()=>{
 window.history.replaceState({marker:'keep'},'','/?auth=recovery&origen=web');
 auth.getSession.mockResolvedValue({data:{session:{user:{id:'owner'}}},error:null});
 let confirm;auth.updateUser.mockReturnValueOnce(new Promise(resolve=>{confirm=resolve;}));
 render(<App/>);await screen.findByRole('heading',{name:'Elegí tu nueva contraseña'});
 expect(screen.getByText('HidroTrack')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Continuar a mi cuenta'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Nueva contraseña'),{target:{value:'ClaveFicticiaDePrueba123!'}});
 fireEvent.change(screen.getByLabelText('Repetir contraseña'),{target:{value:'ClaveFicticiaDePrueba123!'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar y entrar a mi cuenta'}));
 await waitFor(()=>expect(auth.updateUser).toHaveBeenCalled());
 expect(screen.getByRole('button',{name:'Guardando tu contraseña…'}).disabled).toBe(true);
 expect(screen.queryByText('Mi cuenta real')).toBeNull();
 confirm({data:{user:{id:'owner'}},error:null});
 await screen.findByText('Mi cuenta real');expect(window.location.search).toBe('?origen=web');expect(window.history.state).toEqual({marker:'keep'});
});

it('un error al guardar mantiene recuperacion y permite reintentar',async()=>{
 window.history.replaceState(null,'','/?auth=recovery');
 auth.getSession.mockResolvedValue({data:{session:{user:{id:'owner'}}},error:null});
 auth.updateUser.mockResolvedValueOnce({data:{user:null},error:{message:'No disponible'}});
 render(<App/>);await screen.findByRole('heading',{name:'Elegí tu nueva contraseña'});
 fireEvent.change(screen.getByLabelText('Nueva contraseña'),{target:{value:'ClaveFicticiaDePrueba123!'}});
 fireEvent.change(screen.getByLabelText('Repetir contraseña'),{target:{value:'ClaveFicticiaDePrueba123!'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar y entrar a mi cuenta'}));
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('Mi cuenta real')).toBeNull();
 expect(window.location.search).toBe('?auth=recovery');expect(screen.getByRole('button',{name:'Guardar y entrar a mi cuenta'}).disabled).toBe(false);
});
