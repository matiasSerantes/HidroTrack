// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoProgram } from '../src/features/DemoProgram';
import { DEMO_KEY } from '../src/domain/programDemo';

afterEach(() => { cleanup(); localStorage.clear(); });
function enter(assistant = false) {
  render(<DemoProgram onExit={() => {}}/>);
  if (assistant) fireEvent.click(screen.getByText('Lucía · asistente'));
  fireEvent.click(screen.getByText('Continuar'));
  fireEvent.change(screen.getByLabelText('Código del autenticador'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Entrar a la demostración'));
}
describe('recorridos navegables de la demo', () => {
  it('exige el código ficticio y permite atender con efectos visibles para el jefe', () => {
    enter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Repartos y mapa' }));
    fireEvent.click(screen.getAllByText('Atender cliente')[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Dejás Bidón 20 litros'), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText('Retirás Bidón 20 litros'), { target: { value: '2' } });
    fireEvent.click(within(dialog).getByText('Pagó todo'));
    fireEvent.click(within(dialog).getByText('Confirmar visita'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Visitado')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    expect(saved.sales[0].paid).toBe(1530000);
    expect(saved.trips[0].stock.b20).toBe(37);
    fireEvent.change(screen.getByLabelText('Cambiar rol de demostración'), { target: { value: 'owner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir notificaciones' }));
    expect(within(screen.getByRole('dialog')).getByText(/visita registrada en Elena/)).toBeTruthy();
  });
  it('el asistente solicita un cliente y el jefe puede aprobarlo', () => {
    enter(true);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación de la demo' })).getByRole('button', { name: 'Clientes', exact: true }));
    fireEvent.click(screen.getByText('Solicitar alta'));
    const dialog = screen.getByRole('dialog');
    for (const [label, value] of [['Nombre del cliente', 'Nuevo Demo'], ['Dirección', 'Calle 100'], ['Cuadra (calle-altura, para agrupar)', 'calle-100'], ['Pedido habitual', '1 bidón']]) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    fireEvent.click(within(dialog).getByText('Enviar para aprobación'));
    expect(screen.queryByText('Nuevo Demo')).toBeNull();
    fireEvent.change(screen.getByLabelText('Cambiar rol de demostración'), { target: { value: 'owner' } });
    fireEvent.click(screen.getByRole('button', { name: /Aprobaciones/ }));
    const request = screen.getByText('Alta de cliente · Nuevo Demo').closest('article');
    fireEvent.click(within(request).getByText('Aprobar'));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación de la demo' })).getByRole('button', { name: 'Clientes', exact: true }));
    expect(screen.getByText('Nuevo Demo')).toBeTruthy();
  });
  it('todos los apartados del jefe son accesibles sin tocar la base real', () => {
    enter();
    for (const name of ['Repartos y mapa', 'Clientes', 'Artículos y alquileres', 'Carga y rendición', 'Mi equipo', 'Aprobaciones', 'Ventas y cobros', 'Mi empresa']) {
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación de la demo' })).getByRole('button', { name: name === 'Aprobaciones' ? /Aprobaciones/ : name, exact: name !== 'Aprobaciones' }));
      expect(screen.getByRole('heading', { level: 1, name })).toBeTruthy();
    }
  });
  it('abre el mapa dentro de la web y permite mover la ubicación ficticia', async () => {
    enter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Repartos y mapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir mapa y ubicación demo' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText('Tu ubicación actual · DEMO');
    expect(within(dialog).getByRole('region', { name: 'Mapa de calles con clientes y ubicación simulada' })).toBeTruthy();
    expect(within(dialog).getByText('Punto de partida · Monserrat, CABA', { exact: false })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simular avance' }));
    expect(within(dialog).getByText('Llegaste a Av. de Mayo 1200', { exact: false })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(DEMO_KEY) || '{}').sales || []).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abrir ficha' }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Elena Duarte' })).toBeTruthy();
  });
  it('retoma el reparto, la posición y un borrador después de cerrar y volver', async () => {
    enter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir reparto', exact: true }));
    await screen.findByText('Tu ubicación actual · DEMO');
    fireEvent.click(screen.getByRole('button', { name: 'Simular avance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atender: entrega y cobro' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Dejás Bidón 20 litros'), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText('Retirás Bidón 20 litros'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Paga ahora ($)'), { target: { value: '10000' } });
    cleanup(); // Cierra la aplicación; conserva el almacenamiento del navegador.
    render(<DemoProgram onExit={() => {}}/>);
    expect(screen.getByRole('heading', { level: 1, name: 'Mi reparto' })).toBeTruthy();
    const restored = screen.getByRole('dialog');
    expect(within(restored).getByLabelText('Dejás Bidón 20 litros').value).toBe('3');
    expect(within(restored).getByLabelText('Retirás Bidón 20 litros').value).toBe('2');
    expect(within(restored).getByLabelText('Paga ahora ($)').value).toBe('10000');
    fireEvent.click(within(restored).getByText('Confirmar visita'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByText('Llegaste a Av. de Mayo 1200', { exact: false });
    expect(JSON.parse(localStorage.getItem(DEMO_KEY)).sales).toHaveLength(1);
    cleanup();
    render(<DemoProgram onExit={() => {}}/>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.parse(localStorage.getItem(DEMO_KEY)).sales).toHaveLength(1);
  });
  it('el asistente marca ausencias y continúa en el mapa sin crear ventas', async () => {
    enter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir reparto', exact: true }));
    await screen.findByText('Tu ubicación actual · DEMO');
    fireEvent.change(screen.getByLabelText('Resultado de visita de Elena Duarte'), { target: { value: 'later' } });
    expect(screen.getByText('Volver después')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente pendiente' }));
    expect(screen.getByLabelText('Resultado de visita de Café La Esquina')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    expect(saved.trips[0].stops[0].status).toBe('later'); expect(saved.sales).toHaveLength(0);
  });
});
