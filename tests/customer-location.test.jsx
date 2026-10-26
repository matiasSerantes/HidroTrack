// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {CustomerLocationPicker,readCustomerLocation} from '../src/features/CustomerLocationPicker';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('pide GPS solo al tocar el botón y conserva coordenadas para guardar',()=>{
 const getCurrentPosition=vi.fn(success=>success({coords:{latitude:-34.61,longitude:-58.38}}));
 vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}});
 render(<form><CustomerLocationPicker/></form>);expect(getCurrentPosition).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Usar posición actual'}));
 expect(readCustomerLocation(new FormData(document.querySelector('form')))).toEqual({lat:-34.61,lng:-58.38});
 expect(screen.getByRole('button',{name:'Cerrar mapa'})).toBeTruthy();
});
it('informa permiso denegado sin reemplazar el punto anterior',()=>{
 vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:vi.fn((_,error)=>error({code:1}))}});
 render(<form><CustomerLocationPicker initial={{lat:0,lng:0}}/></form>);
 fireEvent.click(screen.getByRole('button',{name:'Usar posición actual'}));expect(screen.getByRole('alert').textContent).toContain('permiso');
 expect(readCustomerLocation(new FormData(document.querySelector('form')))).toEqual({lat:0,lng:0});
});
it('admite ausencia de coordenadas y rechaza un par incompleto o fuera de rango',()=>{
 const f=new FormData();expect(readCustomerLocation(f)).toBeUndefined();f.set('latitude','-34');expect(()=>readCustomerLocation(f)).toThrow('ambas');
 f.set('longitude','999');expect(()=>readCustomerLocation(f)).toThrow('válidas');
});
