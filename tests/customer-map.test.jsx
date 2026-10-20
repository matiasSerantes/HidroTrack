// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CustomerMap, hasLocation, navigationUrl } from '../src/features/CustomerMap';
afterEach(cleanup);
it('rechaza coordenadas incompletas o fuera de rango y usa la dirección como búsqueda alternativa', () => {
 expect(hasLocation({ lat: 0, lng: 0 })).toBe(true);
 expect(hasLocation({ lat: 91, lng: 0 })).toBe(false);
 expect(hasLocation({ lat: -34, lng: undefined })).toBe(false);
 expect(hasLocation({ lat: NaN, lng: 0 })).toBe(false);
 expect(navigationUrl({ address: 'Ejemplo 1', city: 'La Plata' })).toContain('La%20Plata');
});
it('permite seleccionar marcadores sin solicitar la ubicación del usuario al abrir', () => {
 const onSelect = vi.fn(), getCurrentPosition = vi.fn();
 Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
 render(<CustomerMap customers={[{ id: 'a', name: 'Cliente A', address: 'Ejemplo', lat: -34.6, lng: -58.4 }]} onSelect={onSelect}/>);
 fireEvent.click(screen.getByTitle('Cliente A'));
 expect(onSelect).toHaveBeenCalledWith('a');
 expect(getCurrentPosition).not.toHaveBeenCalled();
});
it('mantiene seleccionables los dos clientes que comparten coordenadas', () => {
 const onSelect=vi.fn();
 render(<CustomerMap customers={[{id:'a',name:'Cliente A',address:'Casa',lat:-34.6,lng:-58.4},{id:'b',name:'Cliente B',address:'Local',lat:-34.6,lng:-58.4}]} onSelect={onSelect}/>);
 fireEvent.click(screen.getByTitle('2 clientes en este punto'));
 fireEvent.click(screen.getByText('2. Cliente B'));
 expect(onSelect).toHaveBeenCalledWith('b');
});
