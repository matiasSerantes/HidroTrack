// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoAssistantProfile } from '../src/features/DemoAssistantProfile';
import { seedProgram } from '../src/domain/programDemo';
import { answerTripInvitation, assignedAssistantTrips, assistantAccounts, assistantShareId, linkAssistant, registerDemoAssistant, unlinkAssistant, updateAssistantProfile } from '../src/domain/assistantDemo';
afterEach(cleanup);
it('invitacion pendiente o rechazada no habilita datos; solo el destinatario puede aceptar',()=>{
  let s=seedProgram();s.trips[0].acceptance='pending';
  expect(assignedAssistantTrips(s,'luz')).toHaveLength(0);
  expect(()=>answerTripInvitation(s,'nico','t1',true)).toThrow(/no disponible/);
  const rejected=answerTripInvitation(s,'luz','t1',false);expect(assignedAssistantTrips(rejected,'luz')).toHaveLength(0);
  expect(rejected.notices[0].recipientId).toBe('owner');
  s=answerTripInvitation(s,'luz','t1',true);expect(assignedAssistantTrips(s,'luz')).toHaveLength(1);
  expect(s.notices[0].text).toContain('aceptó');expect(()=>answerTripInvitation(s,'luz','t1',true)).toThrow();
});
it('ID sobrevive a cambios de perfil y quitar/agregar al equipo no recrea la identidad',()=>{
  let s=registerDemoAssistant(seedProgram(),'Persona demo','independiente@example.test').state;
  const account=assistantAccounts(s).find(a=>a.email==='independiente@example.test'),id=assistantShareId(account);
  s=linkAssistant(s,id,'owner');s=updateAssistantProfile(s,account.id,'Nombre nuevo');
  expect(assistantShareId(assistantAccounts(s).find(a=>a.id===account.id))).toBe(id);
  s=unlinkAssistant(s,account.id,'owner');expect(assistantAccounts(s).find(a=>a.id===account.id).name).toBe('Nombre nuevo');
  s=linkAssistant(s,id,'owner');expect(s.members.filter(m=>m.id===account.id)).toHaveLength(1);
  expect(assistantAccounts(s).filter(a=>a.id===account.id)).toHaveLength(1);
});
it('perfil sin vinculo se puede editar y no muestra datos de la empresa',()=>{
  const result=registerDemoAssistant(seedProgram(),'Sin reparto','personal@example.test');
  let saved=result.state;
  render(<DemoAssistantProfile state={saved} actor={result.account.id} onChange={update=>{saved=update(saved);}}/>);
  expect(screen.getByLabelText('Mi ID para compartir').value).toBe(assistantShareId(result.account));
  expect(screen.queryByText('Agua Clara')).toBeNull();expect(screen.queryByText('Elena Duarte')).toBeNull();
  fireEvent.change(screen.getByLabelText('Mi nombre'),{target:{value:'Nuevo nombre'}});fireEvent.click(screen.getByText('Guardar mi perfil'));
  expect(assistantAccounts(saved).find(a=>a.id===result.account.id).name).toBe('Nuevo nombre');
});
it('simular clave no guarda secretos en estado ni almacenamiento',()=>{
  const result=registerDemoAssistant(seedProgram(),'Demo','clave@example.test');let calls=0;
  render(<DemoAssistantProfile state={result.state} actor={result.account.id} onChange={()=>{calls++;}}/>);
  fireEvent.change(screen.getByLabelText('Nueva contraseña de ejemplo'),{target:{value:'ClaveFicticia123!'}});
  fireEvent.change(screen.getByLabelText('Repetir contraseña de ejemplo'),{target:{value:'ClaveFicticia123!'}});
  fireEvent.click(screen.getByText('Simular cambio de contraseña'));
  expect(screen.getByRole('status').textContent).toContain('No se guardó');expect(calls).toBe(0);
  expect(JSON.stringify(result.state)).not.toContain('ClaveFicticia123!');expect(localStorage.length).toBe(0);
});
it('rechaza foto de tipo no admitido sin modificar perfil',()=>{
  expect(()=>updateAssistantProfile(seedProgram(),'luz','Lucía','data:image/svg+xml;base64,PHN2Zz4=')).toThrow(/PNG/);
});
