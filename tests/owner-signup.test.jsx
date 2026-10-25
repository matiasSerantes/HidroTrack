// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AccountAccess} from '../src/features/AccountAccess';
import {OwnerSignupGate} from '../src/features/OwnerSignupGate';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
it('enlace de jefe muestra empresa y crea solo la cuenta Auth con intencion sin licencias del cliente',async()=>{
 window.history.replaceState(null,'','/?registro=jefe');const client={auth:{signUp:vi.fn(async()=>({data:{session:null},error:null}))}};
 render(<AccountAccess client={client} onSession={()=>{}}/>);expect(screen.getByRole('heading',{name:'Crear mi cuenta de jefe'})).toBeTruthy();fireEvent.change(screen.getByLabelText('Mi nombre'),{target:{value:'Jefe ficticio'}});fireEvent.change(screen.getByLabelText('Nombre de mi empresa'),{target:{value:'Empresa ficticia'}});fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'jefe@example.test'}});fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'ClaveFicticia123!'}});fireEvent.change(screen.getByLabelText('Repetir contraseña'),{target:{value:'ClaveFicticia123!'}});fireEvent.click(screen.getByRole('button',{name:'Crear cuenta de jefe'}));await screen.findByText(/Revisá tu correo/);
 expect(client.auth.signUp.mock.calls[0][0].options.data).toEqual({full_name:'Jefe ficticio',signup_kind:'owner',company_name:'Empresa ficticia'});expect(client.auth.signUp.mock.calls[0][0].options.emailRedirectTo).toContain('registro=jefe');
});
it('alta de empresa reintenta sin cambiar nombre y entra al panel tras confirmar estado',async()=>{
 let created=false,attempts=0;const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'u',user_metadata:{signup_kind:'owner',company_name:'Empresa ficticia'}}},error:null})),signOut:vi.fn()},rpc:vi.fn(async(name)=>{if(name==='owner_signup_status')return {data:created?{state:'ready',tenant_id:'t'}:{state:'new',mode:'trial',days:30,driver_limit:1},error:null};if(++attempts===1)return {data:null,error:{message:'Respuesta perdida'}};created=true;return {data:'t',error:null};})};
 render(<OwnerSignupGate client={client} userId="u"><main>Panel de jefe</main></OwnerSignupGate>);await screen.findByText(/Prueba gratuita de 30 días/);fireEvent.click(screen.getByRole('button',{name:'Crear mi empresa'}));await screen.findByText('Respuesta perdida');expect(screen.getByLabelText('Nombre de mi empresa').disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Reintentar alta de empresa'}));await screen.findByText('Panel de jefe');const calls=client.rpc.mock.calls.filter(([n])=>n==='owner_create_workspace');expect(calls).toHaveLength(2);expect(calls[0][1]).toEqual({p_company:'Empresa ficticia'});expect(calls[1][1]).toEqual(calls[0][1]);
});
it('cuenta asistente no ejecuta el alta de jefe',async()=>{
 const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'u',user_metadata:{}}},error:null}))},rpc:vi.fn()};render(<OwnerSignupGate client={client} userId="u"><main>Cuenta existente</main></OwnerSignupGate>);await screen.findByText('Cuenta existente');expect(client.rpc).not.toHaveBeenCalled();
});
it('jefe existente entra sin crear otra empresa o reiniciar licencia',async()=>{
 window.history.replaceState(null,'','/?registro=jefe');const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'u',user_metadata:{}}},error:null}))},rpc:vi.fn(async()=>({data:{state:'ready',tenant_id:'t'},error:null}))};render(<OwnerSignupGate client={client} userId="u"><main>Panel existente</main></OwnerSignupGate>);await screen.findByText('Panel existente');expect(client.rpc.mock.calls.map(([name])=>name)).toEqual(['owner_signup_status']);
});
