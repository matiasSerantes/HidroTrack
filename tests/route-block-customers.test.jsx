// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {RouteBlockCustomers} from '../src/features/RouteBlockCustomers';
afterEach(cleanup);
const stops=[{id:'a',name:'Claudio',address:'Iguazú 8771',locality:'Ciudad',outcome:'pending'},{id:'b',name:'Mariel',address:'Iguazú 8741',locality:'Ciudad',outcome:'delivered'},{id:'c',name:'Otro',address:'Iguazú 8801',locality:'Ciudad',outcome:'pending'}];
it('abre lista de cuadra y permite seleccionar sin registrar visita',()=>{
 const select=vi.fn();render(<RouteBlockCustomers stops={stops} selectedId="a" onSelect={select}/>);
 expect(screen.queryByText('Mariel')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Ver clientes de esta cuadra'}));
 expect(screen.getByText('2 clientes identificados. Confirmá el domicilio antes de atender.')).toBeTruthy();
 expect(screen.getByText('Atendido')).toBeTruthy();expect(screen.queryByText('Otro')).toBeNull();expect(select).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Ver parada de Mariel'}));expect(select).toHaveBeenCalledWith('b');
});
it('bloquea seleccion durante una operacion y no muestra clientes fuera del reparto',()=>{
 const select=vi.fn();render(<RouteBlockCustomers stops={[stops[0]]} selectedId="a" onSelect={select} disabled/>);
 fireEvent.click(screen.getByRole('button',{name:'Ver clientes de esta cuadra'}));
 const button=screen.getByRole('button',{name:'Ver parada de Claudio'});expect(button.disabled).toBe(true);fireEvent.click(button);expect(select).not.toHaveBeenCalled();expect(screen.queryByText('Mariel')).toBeNull();
});
