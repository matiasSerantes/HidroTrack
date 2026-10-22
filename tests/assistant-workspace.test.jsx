// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantWorkspace } from '../src/features/AssistantWorkspace';
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
function fixture({passwordError=null,profileError=null,identity='self'}={}){
  const calls=[];let profile={user_id:'self',full_name:'Mi nombre'};
  const client={rpc:vi.fn(async()=>({data:[],error:null})),auth:{getUser:vi.fn(async()=>({data:{user:{id:identity,email:'personal@example.test'}},error:null})),updateUser:vi.fn(async()=>({data:{user:{id:'self'}},error:passwordError})),signOut:vi.fn(async()=>({error:null}))},from:vi.fn(table=>{const call={table,filters:[],patch:null};calls.push(call);const chain={select:()=>chain,eq:(key,value)=>{call.filters.push([key,value]);return chain;},update:patch=>{call.patch=patch;return chain;},single:async()=>{if(call.patch)profile={...profile,...call.patch};return {data:profile,error:profileError};}};return chain;})};
  render(<AssistantWorkspace client={client} userId="self"/>);return {client,calls};
}
it('carga solo su perfil y su ID, sin consultar informacion comercial o de jefes',async()=>{
  const {client,calls}=fixture();await screen.findByText('Correo: personal@example.test');
  expect(screen.getByLabelText('Mi ID para compartir').value).toBe('HT-SELF');
  expect(client.from).toHaveBeenCalledTimes(1);expect(calls[0]).toMatchObject({table:'user_profiles',filters:[['user_id','self']]});
  expect(screen.queryByRole('navigation')).toBeNull();expect(screen.queryByText('Clientes')).toBeNull();
});
it('guarda nombre solo en su perfil sin cambiar identidad ni membresias',async()=>{
  const {calls,client}=fixture();await screen.findByText('Correo: personal@example.test');
  fireEvent.change(screen.getByLabelText('Mi nombre'),{target:{value:'Nombre actualizado'}});fireEvent.click(screen.getByText('Guardar mi nombre'));
  await screen.findByText('Tu nombre quedó guardado en tu cuenta.');
  expect(calls[1]).toMatchObject({table:'user_profiles',filters:[['user_id','self']],patch:{full_name:'Nombre actualizado'}});
  expect(client.auth.updateUser).not.toHaveBeenCalled();
});
it('valida confirmacion y cambia clave via Auth sin guardar secretos en tablas/localStorage',async()=>{
  const {client,calls}=fixture();await screen.findByText('Correo: personal@example.test');
  fireEvent.click(screen.getByText('Cambiar mi contraseña'));
  fireEvent.change(screen.getByLabelText('Nueva contraseña'),{target:{value:'ClaveSoloDePrueba123!'}});
  fireEvent.change(screen.getByLabelText('Repetir nueva contraseña'),{target:{value:'OtraClaveDePrueba!'}});
  fireEvent.click(screen.getByText('Confirmar cambio de contraseña'));expect(screen.getByRole('alert').textContent).toContain('no coinciden');expect(client.auth.updateUser).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Repetir nueva contraseña'),{target:{value:'ClaveSoloDePrueba123!'}});fireEvent.click(screen.getByText('Confirmar cambio de contraseña'));
  await screen.findByText(/Contraseña actualizada en tu cuenta/);expect(client.auth.updateUser).toHaveBeenCalledWith({password:'ClaveSoloDePrueba123!'});
  expect(calls).toHaveLength(1);expect(localStorage.length).toBe(0);expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
});
it('no simula exito ni evita verificacion cuando Auth exige reautenticacion',async()=>{
  const {client}=fixture({passwordError:{code:'reauthentication_needed',message:'verify'}});await screen.findByText('Correo: personal@example.test');
  fireEvent.click(screen.getByText('Cambiar mi contraseña'));
  for(const label of ['Nueva contraseña','Repetir nueva contraseña'])fireEvent.change(screen.getByLabelText(label),{target:{value:'ClaveSoloDePrueba123!'}});
  fireEvent.click(screen.getByText('Confirmar cambio de contraseña'));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('verificar tu sesión'));expect(client.auth.updateUser).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Nueva contraseña').value).toBe('');
});
it('no habilita edicion si la identidad verificada difiere de la cuenta esperada',async()=>{
  fixture({identity:'other'});await screen.findByRole('alert');expect(screen.getByText('Guardar mi nombre').disabled).toBe(true);
});
