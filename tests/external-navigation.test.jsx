// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { googleNavigation, navigationLegs, pendingNavigationTargets, wazeNavigation } from '../src/domain/externalNavigation';
import { ExternalNavigation } from '../src/features/ExternalNavigation';
afterEach(cleanup);
it('ofrece Waze para cada parada sin enviar multiples destinos ni completar visitas',()=>{
 render(<ExternalNavigation route={[target(3),target(1)]}/>);
 fireEvent.click(screen.getByRole('button',{name:/Abrir navegación/}));fireEvent.click(screen.getByRole('button',{name:/Ver opciones del recorrido/}));
 const links=screen.getAllByRole('link',{name:/parada \d en Waze/});expect(links).toHaveLength(2);
 links.forEach((link,i)=>{const url=new URL(link.href);expect(url.origin).toBe('https://waze.com');expect(url.searchParams.get('ll')).toBe(`${[target(3),target(1)][i].geo.lat},${[target(3),target(1)][i].geo.lng}`);expect(url.searchParams.get('navigate')).toBe('yes');expect(url.searchParams.get('utm_source')).toBe('hidrotrack');expect(url.searchParams.has('waypoints')).toBe(false);expect(link.getAttribute('target')).toBeNull();});
});
it('un destino sin datos no oculta los enlaces Waze de las otras paradas',()=>{
 render(<ExternalNavigation route={[{id:'bad',name:'Sin punto',address:''},target(2)]}/>);
 fireEvent.click(screen.getByRole('button',{name:/Abrir navegación/}));fireEvent.click(screen.getByRole('button',{name:/Ver opciones del recorrido/}));
 expect(screen.getByRole('link',{name:/Ir parada 2 en Waze/})).toBeTruthy();expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
});
const target=(n)=>({id:String(n),name:`Parada ${n}`,address:`Calle ${n}`,locality:'Localidad demo',geo:{lat:-34.6-n/1000,lng:-58.4}});
it('abre destino preciso sin publicar nombre, cuenta, GPS ni origen simulado',()=>{
  const p=target(1),url=new URL(googleNavigation([p]));
  expect(url.origin).toBe('https://www.google.com');expect(url.searchParams.get('api')).toBe('1');
  expect(url.searchParams.get('destination')).toBe(`${p.geo.lat},${p.geo.lng}`);
  expect(url.searchParams.has('origin')).toBe(false);expect(url.searchParams.get('dir_action')).toBe('navigate');
  expect(url.href).not.toContain(p.name);
  const waze=new URL(wazeNavigation(p).href);expect(waze.searchParams.get('ll')).toBe(`${p.geo.lat},${p.geo.lng}`);expect(waze.searchParams.get('navigate')).toBe('yes');
});
it('conserva las diez paradas en orden sin superar tres intermedias por tramo',()=>{
  const all=Array.from({length:10},(_,i)=>target(i+1)),legs=navigationLegs(all);
  expect(legs.map(l=>l.targets.length)).toEqual([4,4,2]);expect(legs.flatMap(l=>l.targets)).toEqual(all);
  legs.forEach(l=>{const url=new URL(l.href);expect(url.searchParams.get('waypoints').split('|')).toHaveLength(l.targets.length-1);expect(url.href.length).toBeLessThanOrEqual(2048);});
  expect(legs[1]).toMatchObject({first:5,last:8});
});
it('usa dirección codificada cuando falta punto y en Waze ofrece búsqueda',()=>{
  const t={id:'address',name:'Demo',address:'San Martín 123 & local | A',locality:'CABA'};
  const url=new URL(googleNavigation([t]));expect(url.searchParams.get('destination')).toBe('San Martín 123 & local   A, CABA, Argentina');
  expect(url.searchParams.has('waypoints')).toBe(false);expect(wazeNavigation(t).precise).toBe(false);
  expect(new URL(wazeNavigation(t).href).searchParams.has('navigate')).toBe(false);
});
it('no omite paradas sin ubicación y reduce tramos por longitud de URL',()=>{
  expect(()=>navigationLegs([target(1),{id:'bad',name:'Sin ubicación',address:''}])).toThrow(/Falta/);
  const long=Array.from({length:4},(_,i)=>({id:String(i),name:'Demo',address:'á'.repeat(100)}));
  const legs=navigationLegs(long);expect(legs.length).toBeGreaterThan(1);expect(legs.flatMap(l=>l.targets)).toEqual(long);expect(legs.every(l=>l.href.length<=2048)).toBe(true);
});
it('pendientes respetan orden del reparto y excluyen visitas terminadas o de otro día',()=>{
  const clients=[target(1),target(2),target(3),target(4)];
  const pending=pendingNavigationTargets(clients,[{clientId:'3',status:'later'},{clientId:'1',status:'visited'},{clientId:'2',status:'pending'},{clientId:'4',status:'tomorrow'}]);
  expect(pending.map(p=>p.id)).toEqual(['3','2']);
  expect(()=>navigationLegs(pendingNavigationTargets([], [{clientId:'missing',status:'pending'}]))).toThrow(/Falta/);
});
it('botón permite elegir parada o todas y avisa que demo no usa origen ficticio',()=>{
  render(<ExternalNavigation selected={target(2)} route={[target(1),target(2),target(3)]} demo/>);
  expect(screen.queryByRole('link')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/Abrir navegación/}));
  expect(screen.getByText(/La app usará tu ubicación real/)).toBeTruthy();
  const link=screen.getByRole('link',{name:/Ir a esta parada en Google Maps/});expect(new URL(link.href).searchParams.get('destination')).toContain(String(target(2).geo.lat));expect(link.rel).toContain('noopener');
  fireEvent.click(screen.getByRole('button',{name:/Ver opciones del recorrido/}));
  expect(screen.getByRole('link',{name:/Abrir recorrido completo \(3 paradas\)/})).toBeTruthy();
});
