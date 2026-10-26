// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {AccountAccess} from '../src/features/AccountAccess';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
function setup(result={data:{session:null,user:{id:'new',identities:[{id:'email'}]}},error:null}){
 window.history.replaceState(null,'','/?registro=jefe');const client={auth:{signUp:vi.fn(async()=>result),resend:vi.fn(async()=>({error:null}))}},onSession=vi.fn();render(<AccountAccess client={client} onSession={onSession}/>);
 for(const [label,value] of [['Mi nombre','Titular ficticio'],['Nombre de mi empresa','Empresa ficticia'],['Correo electrónico','nuevo@example.test'],['Contraseña','ClaveFicticia123!'],['Repetir contraseña','ClaveFicticia123!']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 return {client,onSession,submit:()=>fireEvent.click(screen.getByRole('button',{name:'Crear cuenta de jefe'}))};
}
it('muestra longitud real y enfoca clave corta sin enviar solicitud',async()=>{
 const {client,submit}=setup();for(const label of ['Contraseña','Repetir contraseña'])fireEvent.change(screen.getByLabelText(label),{target:{value:'corta'}});submit();
 expect(await screen.findByText('La contraseña debe tener entre 12 y 128 caracteres. Escribiste 5.')).toBeTruthy();expect(document.activeElement).toBe(screen.getByLabelText('Contraseña'));expect(client.auth.signUp).not.toHaveBeenCalled();
});
it('señala confirmacion distinta y permite mostrar ambas claves',()=>{
 const {client,submit}=setup();fireEvent.change(screen.getByLabelText('Repetir contraseña'),{target:{value:'OtraClaveFicticia!'}});submit();expect(screen.getByText(/Las contraseñas no coinciden/)).toBeTruthy();expect(document.activeElement).toBe(screen.getByLabelText('Repetir contraseña'));fireEvent.click(screen.getByRole('button',{name:'Mostrar contraseñas'}));expect(screen.getByLabelText('Contraseña').type).toBe('text');expect(screen.getByLabelText('Repetir contraseña').type).toBe('text');expect(client.auth.signUp).not.toHaveBeenCalled();
});
it('un registro confirmado deja pantalla clara y conserva correo al ir a ingresar',async()=>{
 const {submit}=setup();submit();await screen.findByRole('heading',{name:'Tu cuenta fue creada'});expect(screen.getByText('nuevo@example.test')).toBeTruthy();expect(screen.queryByRole('button',{name:'Crear cuenta de jefe'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Ya validé · Ir a ingresar'}));expect(screen.getByLabelText('Correo electrónico').value).toBe('nuevo@example.test');
});
it('respuesta de correo duplicado oculta no afirma que creo otra cuenta',async()=>{
 const {submit}=setup({data:{session:null,user:{id:'masked',identities:[]}},error:null});submit();await screen.findByRole('heading',{name:'Solicitud de registro procesada'});expect(screen.queryByRole('heading',{name:'Tu cuenta fue creada'})).toBeNull();expect(screen.getByRole('button',{name:'Recuperar mi contraseña'})).toBeTruthy();
});
it('error conserva nombre empresa correo y borra ambas contraseñas',async()=>{
 const {submit}=setup({data:null,error:{code:'over_email_send_rate_limit'}});submit();await screen.findByText(/Se pidieron varios correos seguidos/);expect(screen.getByLabelText('Mi nombre').value).toBe('Titular ficticio');expect(screen.getByLabelText('Nombre de mi empresa').value).toBe('Empresa ficticia');expect(screen.getByLabelText('Correo electrónico').value).toBe('nuevo@example.test');expect(screen.getByLabelText('Contraseña').value).toBe('');expect(screen.getByLabelText('Repetir contraseña').value).toBe('');
});
it('registro con sesion permite entrar sin mostrar confirmacion pendiente',async()=>{
 const session={access_token:'ficticio',user:{id:'new'}};const {submit,onSession}=setup({data:{session,user:session.user},error:null});submit();await waitFor(()=>expect(onSession).toHaveBeenCalledWith(session));expect(screen.queryByText('Revisá tu correo para continuar.')).toBeNull();
});
it('respuestas vacias no producen exito falso',async()=>{
 const {submit}=setup({data:{user:null,session:null},error:null});submit();await screen.findByText(/No pudimos confirmar la solicitud/);expect(screen.queryByRole('heading',{name:'Tu cuenta fue creada'})).toBeNull();
});
it('el alta muestra cartel y solo usa signup para envio automatico, sin duplicar correo',async()=>{
 const {client,submit}=setup();submit();await screen.findByText('Revisá tu correo y validá tu cuenta');expect(screen.getByText(/Te enviamos automáticamente un enlace/)).toBeTruthy();expect(client.auth.signUp).toHaveBeenCalledTimes(1);expect(client.auth.resend).not.toHaveBeenCalled();
});
it('reenvia confirmacion del mismo correo y conserva destino de alta jefe',async()=>{
 const {client,submit}=setup();submit();fireEvent.click(await screen.findByRole('button',{name:'Reenviar correo de validación'}));await screen.findByText(/Solicitud de reenvío recibida/);
 expect(client.auth.resend).toHaveBeenCalledExactlyOnceWith({type:'signup',email:'nuevo@example.test',options:{emailRedirectTo:expect.stringContaining('registro=jefe')}});expect(client.auth.signUp).toHaveBeenCalledTimes(1);expect(screen.getByText('nuevo@example.test')).toBeTruthy();
});
it('si falla reenvio conserva cartel sin afirmar que envio',async()=>{
 const {client,submit}=setup();client.auth.resend.mockResolvedValue({error:{code:'over_email_send_rate_limit'}});submit();fireEvent.click(await screen.findByRole('button',{name:'Reenviar correo de validación'}));await screen.findByRole('alert');expect(screen.getByText(/No pudimos confirmar el reenvío/)).toBeTruthy();expect(screen.queryByText(/Solicitud de reenvío recibida/)).toBeNull();expect(screen.getByText('nuevo@example.test')).toBeTruthy();
});
it('ingreso de cuenta sin confirmar abre aviso y permite reenviar validacion',async()=>{
 window.history.replaceState(null,'','/');const client={auth:{signInWithPassword:vi.fn(async()=>({data:{session:null},error:{code:'email_not_confirmed'}})),resend:vi.fn(async()=>({error:null}))}},onSession=vi.fn();render(<AccountAccess client={client} onSession={onSession}/>);
 fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'pendiente@example.test'}});fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'ClaveFicticia123!'}});fireEvent.click(screen.getByRole('button',{name:'Ingresar a mi cuenta'}));await screen.findByRole('heading',{name:'Validación de correo pendiente'});expect(onSession).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Reenviar correo de validación'}));await screen.findByText(/Solicitud de reenvío recibida/);expect(client.auth.resend.mock.calls[0][0].email).toBe('pendiente@example.test');
});
