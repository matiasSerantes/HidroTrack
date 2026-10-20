// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { localDate, visitDay, visitsForDate, fetchRoadRoute } from '../src/domain/route';
import { validateDelivery, initialState } from '../src/domain/demo';
import { DemoRoute } from '../src/features/DemoRoute';
vi.mock('../src/features/CustomerMap', async importOriginal => {
 const original = await importOriginal();
 return { ...original, CustomerMap: ({customers,road=[]}) => <div data-testid="route-map">{customers.length} marcadores; {road.length} puntos de camino</div> };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('selecciona el día en Argentina y conserva todos los clientes de una misma cuadra', () => {
 expect(localDate(new Date('2026-10-18T01:00:00Z'))).toBe('2026-10-17');
 expect(visitDay('2026-02-31')).toBe('');
 const visits=visitsForDate(initialState.customers,'2026-10-17');
 expect(visits.map(c=>c.id)).toEqual(['ana','lucia','kiosco']);
 expect(visitsForDate(initialState.customers,'2026-10-19').map(c=>c.id)).toEqual(['maria','jorge']);
});
it('permite volver a entregar otro día pero bloquea duplicados de la misma jornada', () => {
 const delivery={id:'x',customerId:'ana',quantity:1,returned:1,amountCents:200000,paidCents:200000,method:'Efectivo',createdAt:'2026-10-17T14:00:00Z'};
 expect(()=>validateDelivery(delivery,[delivery])).toThrow(/este día/);
 expect(()=>validateDelivery({...delivery,createdAt:'2026-10-18T14:00:00Z'},[delivery])).not.toThrow();
});
it('consulta el camino por calles con coordenadas en el orden elegido', async () => {
 const fetch=vi.fn(async()=>({ok:true,json:async()=>({code:'Ok',routes:[{distance:120,duration:30,geometry:{coordinates:[[-58.4,-34.6],[-58.401,-34.601]]}}]})}));
 vi.stubGlobal('fetch',fetch);
 const route=await fetchRoadRoute([{lat:-34.6,lng:-58.4},{lat:-34.6,lng:-58.4},{lat:-34.601,lng:-58.401}],new AbortController().signal);
 expect(fetch.mock.calls[0][0]).toContain('-58.4,-34.6;-58.401,-34.601');
 expect(route.points[0]).toEqual([-34.6,-58.4]);
});
it('no consulta el servicio si todas las paradas tienen el mismo punto', async () => {
 const fetch=vi.fn(); vi.stubGlobal('fetch',fetch);
 const route=await fetchRoadRoute([{lat:0,lng:0},{lat:0,lng:0}],new AbortController().signal);
 expect(route.distance).toBe(0); expect(fetch).not.toHaveBeenCalled();
});
it('traza el día seleccionado y descarta el camino al cambiar la fecha', async () => {
 vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date('2026-10-17T14:00:00Z'));
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({code:'Ok',routes:[{distance:140,duration:60,geometry:{coordinates:[[-58.38,-34.61],[-58.39,-34.62]]}}]})})));
 render(<DemoRoute customers={initialState.customers} deliveries={[]} onDelivery={()=>{}}/>);
 expect(screen.getByText('1. Ana Fernández')).toBeTruthy();
 expect(screen.queryByText('1. María González')).toBeNull();
 fireEvent.click(screen.getByText('Marcar camino por calles'));
 await screen.findByText(/Camino trazado en el orden/);
 expect(screen.getByTestId('route-map').textContent).toContain('2 puntos');
 fireEvent.change(screen.getByLabelText('Fecha del recorrido'),{target:{value:'2026-10-19'}});
 await waitFor(()=>expect(screen.getByTestId('route-map').textContent).toContain('0 puntos'));
 expect(screen.getByText('1. María González')).toBeTruthy();
});
