// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DemoCustomers } from '../src/features/DemoCustomers';
import { initialState } from '../src/domain/demo';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Fixture({ role = 'owner', onSave = () => {} }) {
 const [state, setState] = useState(() => ({ ...structuredClone(initialState), customers: initialState.customers.map((c, i) => ({ ...c, assignedTo: i === 0 ? 'driver' : 'owner' })), deliveries: [{ id: 'd1', customerId: 'maria', quantity: 2, returned: 1, amountCents: 400000, paidCents: 100000, method: 'Efectivo' }] }));
 return <DemoCustomers role={role} state={state} onSave={next => { onSave(next); setState(next); return true; }}/>;
}
it('edita el cliente y archiva sin perder entregas; reactivar recupera el recorrido', () => {
 const save = vi.fn();
 render(<Fixture onSave={save}/>);
 fireEvent.click(screen.getByLabelText('Ver ficha de María González'));
 fireEvent.click(screen.getByText('Editar cliente'));
 fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'María editada' } });
 fireEvent.change(screen.getByLabelText('Observaciones de entrega'), { target: { value: 'Timbre del local' } });
 fireEvent.click(screen.getByText('Guardar cliente'));
 expect(screen.getByRole('dialog').textContent).toContain('Timbre del local');
 vi.spyOn(window, 'confirm').mockReturnValue(true);
 fireEvent.click(screen.getByText('Eliminar cliente'));
 expect(save.mock.lastCall[0].deliveries).toHaveLength(1);
 expect(save.mock.lastCall[0].order).not.toContain('maria');
 expect(within(screen.getByRole('dialog')).getByText('Archivado')).toBeTruthy();
 fireEvent.click(screen.getByText('Reactivar cliente'));
 expect(save.mock.lastCall[0].order).toContain('maria');
 expect(save.mock.lastCall[0].customers.find(c => c.id === 'maria').notes).toBe('Timbre del local');
 expect(save.mock.lastCall[0].customers.find(c => c.id === 'maria').lat).toBe(initialState.customers[0].lat);
 expect(save.mock.lastCall[0].customers.find(c => c.id === 'maria').assets).toEqual(initialState.customers[0].assets);
 expect(screen.queryByLabelText('Repartidor asignado')).toBeNull();
});
it('no inventa coordenadas a partir de la dirección y permite guardar un punto manual', () => {
 const save = vi.fn();
 render(<Fixture onSave={save}/>);
 fireEvent.click(screen.getByText('Nuevo cliente'));
 fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cliente ubicado' } });
 fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Domicilio de ejemplo 123' } });
 fireEvent.click(screen.getByLabelText('Lun'));
 fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-34.61' } });
 fireEvent.submit(screen.getByText('Guardar cliente').closest('form'));
 expect(save).not.toHaveBeenCalled();
 expect(screen.getByRole('alert').textContent).toMatch(/latitud y longitud/);
 fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-58.40' } });
 fireEvent.click(screen.getByText('Guardar cliente'));
 const next = save.mock.lastCall[0].customers.find(c => c.name === 'Cliente ubicado');
 expect(next).toMatchObject({ lat: -34.61, lng: -58.4, assignedTo: 'owner' });
 expect(screen.getByText('Cómo llegar al cliente ↗').getAttribute('href')).toContain('destination=-34.61,-58.4');
});
it('el chofer solo ve asignados y no puede crear o editar clientes', () => {
 render(<Fixture role="driver"/>);
 expect(screen.getByText('María González')).toBeTruthy();
 expect(screen.queryByText('Carlos López')).toBeNull();
 expect(screen.queryByText('Nuevo cliente')).toBeNull();
 fireEvent.click(screen.getByLabelText('Ver ficha de María González'));
 expect(screen.queryByText('Editar cliente')).toBeNull();
 expect(screen.queryByText('Eliminar cliente')).toBeNull();
});
it('busca por teléfono y filtra por día de visita', () => {
 render(<Fixture/>);
 fireEvent.change(screen.getByPlaceholderText('Nombre, dirección o teléfono'), { target: { value: '0102' } });
 expect(screen.getByText('Carlos López')).toBeTruthy();
 expect(screen.queryByText('María González')).toBeNull();
 fireEvent.change(screen.getByLabelText('Día de visita'), { target: { value: 'Lun' } });
 expect(screen.getByText('No hay clientes que coincidan con estos filtros.')).toBeTruthy();
});
