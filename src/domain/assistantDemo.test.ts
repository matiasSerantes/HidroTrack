import {describe,it,expect} from 'vitest';
import {seedProgram} from './programDemo';
import {assistantAccounts,assignedAssistantTrips,changeAssistantPlan,linkAssistant,otherEmployerLinks,registerDemoAssistant,unlinkAssistant} from './assistantDemo';

describe('cuenta de asistente y vínculo con el jefe · demo',()=>{
 it('registra una cuenta independiente que espera sin crear membresía ni licencia',()=>{
  const {state,account}=registerDemoAssistant(seedProgram(),'Cuenta ficticia','NUEVA@example.com');
  expect(account.email).toBe('nueva@example.com');expect(state.members.some(m=>m.id===account.id)).toBe(false);
  expect(assignedAssistantTrips(state,account.id)).toEqual([]);
  const linked=linkAssistant(state,account.email,'owner');expect(linked.members.find(m=>m.id===account.id)?.active).toBe(true);
  expect(assignedAssistantTrips(linked,account.id)).toEqual([]);
 });
 it('aplica cupos 1, 3 e ilimitado contando vínculos en espera',()=>{
  let s=seedProgram();s.trips=[];s=unlinkAssistant(s,'nico','owner');s=changeAssistantPlan(s,'basic','owner');
  expect(()=>linkAssistant(s,'sofia@example.com','owner')).toThrow('lugares');
  s=changeAssistantPlan(s,'intermediate','owner');s=linkAssistant(s,'sofia@example.com','owner');s=linkAssistant(s,'nico@example.com','owner');
  const {state}=registerDemoAssistant(s,'Otra cuenta','otra@example.com');expect(()=>linkAssistant(state,'otra@example.com','owner')).toThrow('lugares');
  expect(linkAssistant(changeAssistantPlan(state,'unlimited','owner'),'otra@example.com','owner').members.filter(m=>m.role==='driver'&&m.active)).toHaveLength(4);
  expect(()=>changeAssistantPlan(s,'basic','owner')).toThrow('menos lugares');
 });
 it('quitar conserva cuenta, otro jefe e historial y permite volver a agregar la misma identidad',()=>{
  const s=seedProgram();s.trips[0].stage='approved';
  const next=unlinkAssistant(s,'luz','owner');expect(assistantAccounts(next).some(a=>a.id==='luz')).toBe(true);
  expect(otherEmployerLinks(next)).toEqual(otherEmployerLinks(s));expect(next.trips).toEqual(s.trips);
  expect(assignedAssistantTrips(next,'luz')).toEqual([]);
  const linked=linkAssistant(next,'LUZ@example.com','owner');expect(linked.members.filter(m=>m.id==='luz')).toHaveLength(1);
  expect(assignedAssistantTrips(linked,'luz')).toEqual([]);
 });
 it('requiere jefe, cuenta existente y resolver recorridos antes de quitar',()=>{
  const s=seedProgram();expect(()=>linkAssistant(s,'sofia@example.com','luz')).toThrow('Solo el jefe');
  expect(()=>linkAssistant(s,'nadie@example.com','owner')).toThrow('No existe');
  expect(()=>linkAssistant(s,'luz@example.com','owner')).toThrow('ya está');
  expect(()=>unlinkAssistant(s,'luz','owner')).toThrow('Reasigná');expect(()=>unlinkAssistant(s,'nico','owner')).toThrow('Reasigná');
  expect(()=>registerDemoAssistant(s,'Otra','luz@example.com')).toThrow('Ya existe');
 });
});
