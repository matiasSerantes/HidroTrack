// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {AssistantTripInvitations} from '../src/features/TripInvitations';
import {OwnerAssistantClosures} from '../src/features/AssistantClose';
import {downloadSharedClosePdf} from '../src/domain/sharedCloseReceiptPdf';
vi.mock('../src/domain/sharedCloseReceiptPdf',()=>({downloadSharedClosePdf:vi.fn()}));

afterEach(() => { cleanup(); localStorage.clear(); });

it('recorre carga, entrega con retorno y pago parcial, rendicion y aprobacion sin duplicar movimientos',async () => {
  // Stateful RPC stand-in: exercises screens together, not a production/SQL validation.
  let status = 'planned', delivered = false, closure = null;
  let ready = 0, empties = 0;
  const trip = () => ({id:'r', name:'Ruta de prueba integral', date:'2026-10-26', status});
  const stock = () => [{product_id:'p', name:'Agua', family:'article', ready, empties}];
  const summary = () => ({trip:trip(), stock:stock(), initial_load:[{product_id:'p',name:'Agua',loaded:4}], cash:100, transfer:0, sales:200, pending_visits:delivered?0:1, equipment_count:0, pending_closure:false});
  const commands = new Map();
  const client = {rpc:vi.fn(async (name,args) => {
    switch(name) {
      case 'assistant_trip_invitations': return {data:[{tenant_id:'a',trip_id:'r',name:'Ruta de prueba integral',date:'2026-10-26',state:'accepted',status,company:'Empresa ficticia',chief:'Jefe ficticio'}],error:null};
      case 'assistant_open_trip': return {data:{trip:trip(),stops:[{id:'c',name:'Cliente ficticio',address:'Calle 100',phone:'',position:1,outcome:delivered?'delivered':'pending',pending_recovery:false}],stock:stock().map(p=>({...p,unit:'unidad',returnable:true,loaded:4}))},error:null};
      case 'assistant_load_options': return {data:{date:'2026-10-26',products:[{id:'p',name:'Agua',family:'article',unit:'unidad',returnable:true,ready:5,empties:0,suggested:4}]},error:null};
      case 'assistant_confirm_load': {
        expect(status).toBe('planned'); expect(args.p_items).toEqual([{product_id:'p',quantity:4}]);
        ready=4; status='active'; return {data:args.p_id,error:null};
      }
      case 'assistant_customer_visit': return {data:{customer:{id:'c',name:'Cliente ficticio',pending_recovery:false},version:1,outcome:delivered?'delivered':'pending',balance:0,products:[{id:'p',name:'Agua',price:100,active:true,returnable:true,ready,held:1}],equipment:[]},error:null};
      case 'assistant_deliver': {
        if (commands.has(args.p_id)) return {data:commands.get(args.p_id),error:null};
        expect(status).toBe('active'); expect(delivered).toBe(false);
        expect(args).toMatchObject({p_items:[{product_id:'p',quantity:2,returned:1}],p_paid:100,p_expected_total:200,p_method:'cash'});
        ready-=2; empties+=1; delivered=true;
        commands.set(args.p_id,{id:args.p_id,total:200,paid:100,remaining:100,credit_status:'pending'});
        return {data:null,error:{message:'Confirmación perdida después de registrar'}};
      }
      case 'assistant_close_state': return {data:closure,error:null};
      case 'assistant_preview_close': return {data:summary(),error:null};
      case 'assistant_submit_close': {
        expect(delivered).toBe(true); expect(args.p_cash).toBe(100);
        expect(args.p_stock).toEqual([{product_id:'p',ready:2,empties:1}]);
        closure={...summary(),id:args.p_id,tenant_id:'a',company:'Empresa ficticia',closure_state:'submitted',declared_cash:100,declared_transfer:0,declared_stock:args.p_stock,driver:'Asistente ficticio'};
        status='submitted'; return {data:closure,error:null};
      }
      case 'owner_assistant_close_inbox': return {data:[closure],error:null};
      case 'trip_close_receipt': {
        expect(status).toBe('closed'); expect(args).toEqual({p_tenant:'a',p_id:closure.id});
        return {data:{role:'owner',receipt:closure},error:null};
      }
      case 'trip_review_close': {
        expect(status).toBe('submitted'); expect(args.p_approve).toBe(true);
        closure={...closure,closure_state:'approved'}; status='closed'; return {data:'approved',error:null};
      }
      default: throw new Error(`RPC inesperada: ${name}`);
    }
  })};
  const view=render(<AssistantTripInvitations client={client} userId="journey-driver"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));
  fireEvent.click(await screen.findByRole('button',{name:'Usar carga sugerida'}));
  fireEvent.click(screen.getByLabelText('Revisé la carga física y confirmo estas cantidades.'));
  fireEvent.click(screen.getByRole('button',{name:'Registrar carga e iniciar reparto'}));
  await screen.findByText('En recorrido');
  fireEvent.click(screen.getByRole('button',{name:'Atender cliente'}));
  fireEvent.change(await screen.findByLabelText('Entregar Agua'),{target:{value:'2'}});
  fireEvent.change(screen.getByLabelText('Devuelve Agua'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Cuánto paga ahora ($)'),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirmar entrega y cobro'}));
  await screen.findByText('Confirmación perdida después de registrar');
  fireEvent.click(screen.getByRole('button',{name:'Reintentar misma entrega'}));
  await screen.findByText(/Atendidos: 1 de 1 clientes/);
  expect({ready,empties}).toEqual({ready:2,empties:1});
  fireEvent.click(screen.getByRole('button',{name:'Stock del camión'}));
  await screen.findByText('2 llenos / unidades listas · 1 vacíos');
  fireEvent.click(screen.getByRole('button',{name:'Terminar y rendir reparto'}));
  await screen.findByLabelText('Efectivo contado ($)');
  fireEvent.click(screen.getByLabelText('Revisé dinero y mercadería de regreso.'));
  fireEvent.click(screen.getByRole('button',{name:'Enviar rendición al jefe'}));
  await screen.findByText(/Rendición enviada/);
  view.unmount();
  render(<OwnerAssistantClosures client={client} tenantId="a" disabled={false} onLock={()=>{}} onDone={()=>{}}/>);
  await screen.findByText('Asistente ficticio · 2026-10-26');
  fireEvent.click(screen.getByText('Ruta de prueba integral · Por revisar'));
  fireEvent.click(screen.getByLabelText('Revisé caja y mercadería con el asistente.'));
  fireEvent.click(screen.getByRole('button',{name:'Confirmar revisión de rendición'}));
  await screen.findByText('Reparto aprobado y cerrado. El stock volvió al depósito.');
  await screen.findByText('Ruta de prueba integral · Aprobada');
  expect(status).toBe('closed');
  const calls=name=>client.rpc.mock.calls.filter(([n])=>n===name);
  expect(calls('assistant_confirm_load')).toHaveLength(1);
  expect(calls('assistant_submit_close')).toHaveLength(1);
  expect(calls('trip_review_close')).toHaveLength(1);
  expect(calls('assistant_deliver')).toHaveLength(2);
  expect(calls('assistant_deliver')[0][1]).toEqual(calls('assistant_deliver')[1][1]);
  fireEvent.click(await screen.findByRole('button',{name:'Descargar PDF del jefe'}));
  await waitFor(()=>expect(downloadSharedClosePdf).toHaveBeenCalledExactlyOnceWith(closure,'owner'));
  expect(calls('trip_close_receipt')).toHaveLength(1);
  expect(calls('trip_review_close')).toHaveLength(1);
});
