// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoPromotions } from '../src/features/DemoPromotions';
import { DemoProgram } from '../src/features/DemoProgram';
import { archiveDemoProduct, demoOwnedStock, seedProgram } from '../src/domain/programDemo';
import { createPromotion, decidePromotion, recoverPromotion } from '../src/domain/promotionsDemo';
afterEach(()=>{cleanup();localStorage.clear();});
const input={name:'Persona demo',address:'Dirección de ejemplo',phone:'',terms:'Prueba por una semana; condiciones de ejemplo.',followUp:'2026-10-26',items:{b20:2,frio:1}};
const start=()=>createPromotion(seedProgram(),'owner',input);
it('separa prospectos de clientes y conserva patrimonio, disponibilidad y permisos',()=>{
  const original=seedProgram(),s=start();expect(s.clients).toHaveLength(original.clients.length);
  expect(s.products.find(p=>p.id==='b20').depot).toBe(original.products[0].depot-2);
  expect(demoOwnedStock(s,'b20').total).toBe(demoOwnedStock(original,'b20').total);
  expect(demoOwnedStock(s,'b20').promotionHeld).toBe(2);
  expect(()=>archiveDemoProduct(s,'frio','owner')).toThrow(/unidades activas/);
  expect(()=>createPromotion(original,'luz',input)).toThrow(/jefe/);
  expect(()=>createPromotion(original,'owner',{...input,items:{b20:9999}})).toThrow(/suficientes/);
  expect(original.products[0].depot).toBe(240);
});
it('aceptar convierte una vez sin repetir salida y transfiere envases, equipo y contacto',()=>{
  const s=start(),id=s.promotions[0].id,next=decidePromotion(s,'owner',id,true,{frio:1800000});
  const c=next.clients.find(c=>c.id===next.promotions[0].clientId);
  expect(c.held).toEqual({b20:2});expect(c.rentals[0]).toMatchObject({productId:'frio',monthly:1800000,mode:'rental'});
  expect(next.products).toEqual(s.products);expect(next.sales).toEqual([]);expect(next.promotions[0].held).toEqual({});
  expect(demoOwnedStock(next,'b20').total).toBe(demoOwnedStock(s,'b20').total);
  expect(demoOwnedStock(next,'frio').total+c.rentals.length).toBe(demoOwnedStock(s,'frio').total);
  expect(()=>decidePromotion(next,'owner',id,true)).toThrow(/resuelta/);
});
it('rechazo conserva pendientes, admite devolución parcial y separa daño del disponible',()=>{
  let s=start();const id=s.promotions[0].id;
  s=decidePromotion(s,'owner',id,false);
  s=recoverPromotion(s,'owner',id,{b20:{good:1,damaged:0}});
  expect(s.promotions[0].status).toBe('recovery');expect(s.promotions[0].held.b20).toBe(1);
  expect(()=>decidePromotion(s,'owner',id,true)).toThrow(/resuelta/);
  const before=s.products.find(p=>p.id==='frio').depot;
  s=recoverPromotion(s,'owner',id,{b20:{good:1,damaged:0},frio:{good:0,damaged:1}});
  expect(s.promotions[0].status).toBe('closed');expect(s.products.find(p=>p.id==='frio').depot).toBe(before);
  expect(demoOwnedStock(s,'frio').repair).toBe(1);expect(s.depotEmpties.b20).toBe(seedProgram().depotEmpties.b20+2);
  expect(demoOwnedStock(s,'frio').total).toBe(demoOwnedStock(seedProgram(),'frio').total);
  expect(()=>recoverPromotion(s,'owner',id,{b20:{good:1,damaged:0}})).toThrow();
});
it('no permite sobredevoluciones y revierte la operación completa',()=>{
  const trial=start(),s=decidePromotion(trial,'owner',trial.promotions[0].id,false),before=structuredClone(s);
  expect(()=>recoverPromotion(s,'owner',s.promotions[0].id,{b20:{good:1,damaged:0},frio:{good:2,damaged:0}})).toThrow(/más/);
  expect(s).toEqual(before);
});
it('formulario crea una promoción y permite aceptar desde su ficha',()=>{
  function Example(){const [s,set]=React.useState(seedProgram());return <DemoPromotions state={s} actor="owner" onChange={update=>set(update)}/>;}
  render(<Example/>);fireEvent.click(screen.getByText('Nueva promoción'));
  fireEvent.change(screen.getByLabelText('Nombre de la persona'),{target:{value:input.name}});
  fireEvent.change(screen.getByLabelText('Dirección'),{target:{value:input.address}});
  fireEvent.change(screen.getByLabelText('Condiciones y precio acordados para la prueba'),{target:{value:input.terms}});
  fireEvent.change(screen.getByLabelText('Entregar Bidón 20 litros'),{target:{value:'2'}});
  fireEvent.click(screen.getByText('Registrar entrega de prueba'));
  expect(screen.getByText('En prueba')).toBeTruthy();fireEvent.click(screen.getByText('Acepta · pasar a cliente'));
  expect(screen.getByText('Convertida en cliente')).toBeTruthy();
});
it('muestra el apartado al jefe y lo oculta al cambiar a asistente',()=>{
  render(<DemoProgram onExit={()=>{}}/>);
  fireEvent.click(screen.getByText('Continuar'));
  fireEvent.change(screen.getByLabelText('Código del autenticador'),{target:{value:'123456'}});
  fireEvent.click(screen.getByText('Entrar a la demostración'));
  fireEvent.click(screen.getByRole('button',{name:'Promociones',exact:true}));
  expect(screen.getByRole('heading',{name:'Promociones en prueba'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Cambiar rol de demostración'),{target:{value:'luz'}});
  expect(screen.queryByRole('button',{name:'Promociones',exact:true})).toBeNull();
});
