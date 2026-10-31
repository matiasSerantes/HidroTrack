// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {AssistantTripInvitations} from '../src/features/TripInvitations';

afterEach(() => { cleanup(); localStorage.clear(); });
const stop = {id:'c', name:'Cliente ficticio', address:'Calle 100', phone:'', position:1, outcome:'pending', pending_recovery:false, visit_start:'16:00', visit_end:'17:00', visit_starts_at:'2026-10-26T19:00:00Z'};
const quote = {trip:{id:'r', name:'Ruta ficticia', date:'2026-10-26', status:'active'}, cash:100, transfer:0, sales:100, pending_visits:0, equipment_count:0, pending_closure:false, stock:[{product_id:'p', name:'Agua', family:'article', ready:2, empties:1}], initial_load:[{product_id:'p', name:'Agua', loaded:3}]};
function fixture(operation) {
  let resolve;
  const response = new Promise(r => { resolve = r; });
  const client = {rpc:vi.fn(async (name,args) => {
    if (name === operation) return response;
    switch(name) {
      case 'assistant_trip_invitations': return {data:[{tenant_id:'a', trip_id:'r', name:'Ruta ficticia', date:'2026-10-26', state:'accepted', status:'active', company:'Empresa ficticia', chief:'Jefe ficticio'}], error:null};
      case 'assistant_open_trip': return {data:{server_now:'2026-10-26T18:05:00Z', trip:quote.trip, stops:[stop], stock:[]}, error:null};
      case 'assistant_customer_visit': return {data:{customer:{id:'c', name:stop.name, pending_recovery:false}, version:1, outcome:'pending', balance:0, products:[{id:'p', name:'Agua', price:100, returnable:true, active:true, ready:3, held:0}], equipment:[]}, error:null};
      case 'assistant_close_state': return {data:null, error:null};
      case 'assistant_preview_close': return {data:quote, error:null};
      case 'customer_proposal_inbox': return {data:{count:0, items:[]}, error:null};
      default: throw new Error(`RPC inesperada: ${name} ${JSON.stringify(args)}`);
    }
  })};
  render(<AssistantTripInvitations client={client} userId="test-driver"/>);
  return {client, resolve};
}
async function openVisit() {
  fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));
  fireEvent.click(await screen.findByRole('button',{name:'Atender cliente'}));
  await screen.findByLabelText('Entregar Agua');
}
async function openClose() {
  fireEvent.click(screen.getByRole('button',{name:'Terminar y rendir reparto'}));
  await screen.findByLabelText('Efectivo contado ($)');
  fireEvent.click(screen.getByLabelText('Revisé dinero y mercadería de regreso.'));
}
const blocked = label => expect(screen.getByRole('button',{name:label}).matches(':disabled')).toBe(true);

it('una rendicion en vuelo bloquea una planilla ya abierta y conserva su propio reintento',async () => {
  const {client, resolve} = fixture('assistant_submit_close');
  await openVisit();
  fireEvent.change(screen.getByLabelText('Entregar Agua'),{target:{value:'1'}});
  await openClose();
  fireEvent.click(screen.getByRole('button',{name:'Enviar rendición al jefe'}));
  await waitFor(() => blocked('Confirmar entrega y cobro'));
  blocked('No está / no compró'); blocked('Cobrar saldo pendiente');
  blocked('No llegué a horario · Cliente ficticio');
  fireEvent.click(screen.getByRole('button',{name:'Confirmar entrega y cobro'}));
  expect(client.rpc.mock.calls.some(([name]) => name === 'assistant_deliver')).toBe(false);
  await act(async () => resolve({data:null, error:{message:'Respuesta perdida'}}));
  await screen.findByText('Respuesta perdida');
  blocked('Atender cliente');
  expect(screen.getByRole('button',{name:'Reintentar misma rendición'}).disabled).toBe(false);
  fireEvent(window,new Event('focus'));
  expect(screen.getByRole('button',{name:'Reintentar misma rendición'}).disabled).toBe(false);
});

it('detener un aviso bloquea entrega y rendicion abiertas hasta recibir confirmacion',async () => {
  const {client, resolve} = fixture('route_dismiss_time_reminder');
  await openVisit(); await openClose();
  fireEvent.click(screen.getByRole('button',{name:'No llegué a horario · Cliente ficticio'}));
  await waitFor(() => blocked('Confirmar entrega y cobro'));
  blocked('Enviar rendición al jefe'); blocked('Terminar y rendir reparto');
  await act(async () => resolve({data:null, error:{message:'Respuesta perdida'}}));
  await screen.findByRole('button',{name:'Reintentar detener aviso'});
  expect(screen.getByRole('button',{name:'Reintentar detener aviso'}).disabled).toBe(false);
  blocked('Confirmar entrega y cobro'); blocked('Enviar rendición al jefe');
  expect(client.rpc.mock.calls.some(([name]) => ['assistant_deliver','assistant_submit_close'].includes(name))).toBe(false);
});

it('una entrega pendiente bloquea rendicion y recordatorios sin bloquear su reintento',async () => {
  const {client, resolve} = fixture('assistant_deliver');
  await openVisit(); await openClose();
  fireEvent.change(screen.getByLabelText('Entregar Agua'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:'Paga el total'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirmar entrega y cobro'}));
  await waitFor(() => blocked('Enviar rendición al jefe'));
  blocked('No llegué a horario · Cliente ficticio');
  await act(async () => resolve({data:null, error:{message:'Respuesta perdida'}}));
  await screen.findByText('Respuesta perdida');
  expect(screen.getByRole('button',{name:'Reintentar misma entrega'}).disabled).toBe(false);
  blocked('Enviar rendición al jefe');
  expect(client.rpc.mock.calls.filter(([name]) => name === 'assistant_deliver')).toHaveLength(1);
});

it('una rendicion bloquea tambien un alta ya abierta y un rechazo verificable libera las otras acciones',async () => {
  const {resolve} = fixture('assistant_submit_close');
  await openVisit();
  fireEvent.click(screen.getByRole('button',{name:'Agregar cliente durante el reparto'}));
  const propose = await screen.findByRole('button',{name:'Proponer nuevo cliente'});
  await waitFor(()=>expect(propose.disabled).toBe(false));
  fireEvent.click(propose);
  await screen.findByLabelText('Nombre del nuevo cliente');
  await openClose();
  fireEvent.click(screen.getByRole('button',{name:'Enviar rendición al jefe'}));
  await waitFor(()=>blocked('Enviar alta al jefe'));
  await act(async()=>resolve({data:null,error:{code:'P0001',message:'El resumen cambió; actualizá'}}));
  await screen.findByText('El resumen cambió; actualizá');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Enviar alta al jefe'}).matches(':disabled')).toBe(false));
  expect(screen.getByRole('button',{name:'Atender cliente'}).disabled).toBe(false);
  expect(screen.queryByRole('button',{name:'Reintentar misma rendición'})).toBeNull();
});
