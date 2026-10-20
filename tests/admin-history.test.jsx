// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AdminAccessHistory } from '../src/features/AdminAccessHistory';
afterEach(cleanup);
const events=[{id:'event',tenant_name:'Empresa A',user_email:'chofer@example.test',actor_email:'admin@example.test',is_active:false,created_at:'2026-10-20T02:30:00Z'}];
it('muestra empresa, persona, acción, administrador y fecha argentina sin consultar servidor en demo',()=>{
 const client={rpc:vi.fn()};
 render(<AdminAccessHistory demo client={client} events={events} revision={0}/>);
 expect(screen.getByText('Acceso pausado')).toBeTruthy();
 expect(screen.getByText('admin@example.test')).toBeTruthy();
 expect(screen.getByText('chofer@example.test')).toBeTruthy();
 expect(screen.getByText(/19\/10\/2026/)).toBeTruthy();
 expect(client.rpc).not.toHaveBeenCalled();
});
it('distingue actualización pendiente de un historial vacío y permite reintentar',async()=>{
 const client={rpc:vi.fn().mockResolvedValueOnce({error:{code:'PGRST202'}}).mockResolvedValueOnce({data:events,error:null})};
 render(<AdminAccessHistory client={client} demo={false} events={[]} revision={0}/>);
 await screen.findByRole('alert');
 expect(screen.queryByText('Todavía no hay cambios de acceso registrados.')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Actualizar historial'}));
 expect(await screen.findByText('Acceso pausado')).toBeTruthy();
 expect(screen.queryByRole('alert')).toBeNull();
 expect(client.rpc).toHaveBeenCalledWith('admin_access_history');
});
