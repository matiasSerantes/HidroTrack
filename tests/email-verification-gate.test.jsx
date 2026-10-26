// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {EmailVerificationGate} from '../src/features/EmailVerificationGate';
afterEach(()=>{cleanup();vi.useRealTimers();});
function fixture(state='provisional'){
 const now=Date.now(),status={state,email:'ficticio@example.test',server_now:new Date(now).toISOString(),deadline:new Date(now+86400000).toISOString()};
 const client={rpc:vi.fn(async()=>({data:{...status},error:null})),auth:{signInWithOtp:vi.fn(async()=>({error:null})),signOut:vi.fn(),onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}}))}};
 render(<EmailVerificationGate client={client} userId="u"><main>Reparto real</main></EmailVerificationGate>);return {client,status};
}
it('permite usar durante plazo y solicita enlace para el correo del servidor sin crear otro usuario',async()=>{
 const {client}=fixture();await screen.findByText('Reparto real');await waitFor(()=>expect(client.auth.signInWithOtp).toHaveBeenCalledTimes(1));expect(client.auth.signInWithOtp).toHaveBeenCalledWith({email:'ficticio@example.test',options:{shouldCreateUser:false,emailRedirectTo:expect.any(String)}});expect(screen.getByText('Tenés 24 horas para validar tu correo')).toBeTruthy();
});
it('vencido bloquea contenido y recupera misma cuenta al validar',async()=>{
 const {client,status}=fixture('expired');await screen.findByText('Validá tu correo para continuar');expect(screen.queryByText('Reparto real')).toBeNull();expect(client.auth.signInWithOtp).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Enviar enlace de validación'}));await screen.findByText(/Enlace solicitado/);status.state='verified';fireEvent.click(screen.getByRole('button',{name:'Ya validé · Actualizar estado'}));await screen.findByText('Reparto real');expect(screen.queryByText('Validá tu correo para continuar')).toBeNull();
});
it('cuenta ya verificada entra sin pedir correos',async()=>{
 const {client}=fixture('verified');await screen.findByText('Reparto real');expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
});
it('fallo de consulta inicial no muestra datos ni afirma validacion',async()=>{
 const client={rpc:vi.fn(async()=>({data:null,error:{message:'offline'}})),auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),signOut:vi.fn()}};render(<EmailVerificationGate client={client} userId="u"><main>Reparto real</main></EmailVerificationGate>);await screen.findByRole('alert');expect(screen.queryByText('Reparto real')).toBeNull();
});
