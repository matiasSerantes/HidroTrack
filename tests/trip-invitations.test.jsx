// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantTripInvitations, OwnerTripInvitations,assistantRouteKey } from '../src/features/TripInvitations';
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
const invitation={tenant_id:'company-a',trip_id:'trip-a',name:'Lunes por la manana',date:'2026-10-26',status:'planned',state:'pending',company:'Empresa A',chief:'Jefe A',driver:'Chofer A'};
it('no consulta clientes antes de aceptar y permite abrir resumen despues',async()=>{
 let state='pending';const client={rpc:vi.fn(async(name,args)=>{
  if(name==='assistant_trip_invitations')return {data:[{...invitation,state}],error:null};
  if(name==='assistant_answer_trip_invitation'){expect(args.p_accept).toBe(true);expect(args.p_trip).toBe('trip-a');state='accepted';return {data:state,error:null};}
  if(name==='assistant_open_trip')return {data:{trip:{name:'Lunes por la manana'},stops:[{id:'customer-a',name:'Cliente asignado',address:'Direccion asignada',phone:'',position:1,outcome:'pending',pending_recovery:false}]},error:null};
 })};
 render(<AssistantTripInvitations client={client}/>);
 const accept=await screen.findByRole('button',{name:'Aceptar reparto'});
 expect(client.rpc.mock.calls.some(([n])=>n==='assistant_open_trip')).toBe(false);
 expect(screen.queryByText('Cliente asignado')).toBe(null);
 fireEvent.click(accept);fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));
 expect(await screen.findByText('1. Cliente asignado')).toBeTruthy();
});
it('elimina resumen visible si el jefe revoca al actualizar',async()=>{
 let state='accepted';const client={rpc:vi.fn(async(name)=>name==='assistant_trip_invitations'?{data:[{...invitation,state}],error:null}:{data:{trip:{name:'Resumen aceptado'},stops:[]},error:null})};
 render(<AssistantTripInvitations client={client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));await screen.findByText('Resumen aceptado');
 state='revoked';fireEvent.click(screen.getByRole('button',{name:'Actualizar recorridos'}));
 await waitFor(()=>expect(screen.queryByText('Resumen aceptado')).toBe(null));
 expect(screen.queryByRole('button',{name:'Abrir reparto'})).toBe(null);
});
it('el jefe retira invitacion con confirmacion y avisa al padre',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);let state='pending';const onChanged=vi.fn(),onLock=vi.fn();const client={rpc:vi.fn(async(name)=>{
  if(name==='owner_revoke_trip_invitation'){state='revoked';return {data:state,error:null};}
  return {data:[{...invitation,state}],error:null};
 })};
 render(<OwnerTripInvitations client={client} tenantId="company-a" disabled={false} onLock={onLock} onChanged={onChanged} refreshKey="trip-a"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Retirar invitación'}));
 await waitFor(()=>expect(onChanged).toHaveBeenCalled());
 expect(client.rpc.mock.calls.find(([n])=>n==='owner_revoke_trip_invitation')[1]).toMatchObject({p_tenant:'company-a',p_trip:'trip-a'});
});
const activeRoute={trip:{name:'Ruta real',status:'active',date:'2026-10-24'},stops:[{id:'c1',name:'Primero',address:'Calle 1',phone:'',outcome:'pending',position:1},{id:'c2',name:'Segundo',address:'Calle 2',phone:'',outcome:'delivered',position:2}],stock:[{product_id:'p',name:'Agua del camion',unit:'unidad',returnable:true,family:'article',loaded:5,ready:3,empties:2}]};
it('retoma parada tras recarga guardando solo identificadores por cuenta',async()=>{
 const client={rpc:vi.fn(async name=>({data:name==='assistant_trip_invitations'?[{...invitation,state:'accepted'}]:activeRoute,error:null}))};
 const first=render(<AssistantTripInvitations client={client} userId="one"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));await screen.findByText('1. Primero');
 fireEvent.change(screen.getByLabelText('Parada del recorrido'),{target:{value:'c2'}});await screen.findByText('2. Segundo');
 expect(JSON.parse(localStorage.getItem(assistantRouteKey('one')))).toEqual({tenant:'company-a',trip:'trip-a',stop:'c2'});
 expect(localStorage.getItem(assistantRouteKey('one'))).not.toContain('Calle');
 first.unmount();render(<AssistantTripInvitations client={client} userId="one"/>);await screen.findByText('2. Segundo');
 fireEvent.click(screen.getByRole('button',{name:'Stock del camión'}));expect(screen.getByText('Agua del camion')).toBeTruthy();expect(screen.getByText('3 llenos / unidades listas · 2 vacíos')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cerrar recorrido'}));expect(localStorage.getItem(assistantRouteKey('one'))).toBe(null);
});
it('otra cuenta no restaura el recorrido guardado y revocacion elimina el puntero',async()=>{
 localStorage.setItem(assistantRouteKey('one'),JSON.stringify({tenant:'company-a',trip:'trip-a',stop:'c1'}));
 const client={rpc:vi.fn(async name=>({data:name==='assistant_trip_invitations'?[{...invitation,state:'revoked'}]:activeRoute,error:null}))};
 const other=render(<AssistantTripInvitations client={client} userId="two"/>);await screen.findByText('Retirado por el jefe');expect(client.rpc.mock.calls.some(([n])=>n==='assistant_open_trip')).toBe(false);
 other.unmount();render(<AssistantTripInvitations client={client} userId="one"/>);await screen.findByText('Retirado por el jefe');await waitFor(()=>expect(localStorage.getItem(assistantRouteKey('one'))).toBe(null));
});
it('oculta stock y clientes si falla la verificacion al actualizar',async()=>{
 let fail=false;const client={rpc:vi.fn(async name=>({data:name==='assistant_trip_invitations'?[{...invitation,state:'accepted'}]:fail?null:activeRoute,error:fail&&name==='assistant_open_trip'?{code:'42501'}:null}))};
 render(<AssistantTripInvitations client={client}/>);fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));await screen.findByText('1. Primero');
 fireEvent.click(screen.getByRole('button',{name:'Stock del camión'}));expect(screen.getByText('Agua del camion')).toBeTruthy();
 fail=true;fireEvent.click(screen.getByRole('button',{name:'Actualizar recorridos'}));await screen.findByRole('alert');expect(screen.queryByText('1. Primero')).toBe(null);expect(screen.queryByText('Agua del camion')).toBe(null);
});
it('no cambia de cliente ni pierde el reintento si la entrega se guardo pero se perdio la respuesta',async()=>{
 let delivered=false;const client={rpc:vi.fn(async(name,args)=>{
  if(name==='assistant_trip_invitations')return {data:[{...invitation,state:'accepted'}],error:null};
  if(name==='assistant_open_trip')return {data:{...activeRoute,stops:activeRoute.stops.map((s,i)=>({...s,outcome:i===0&&delivered?'delivered':'pending'}))},error:null};
  if(name==='assistant_customer_visit')return {data:{customer:{id:'c1',name:'Primero',pending_recovery:false},version:1,outcome:'pending',balance:0,products:[{id:'p',name:'Agua',price:100,ready:3,held:0,active:true,returnable:true}],equipment:[]},error:null};
  if(name==='assistant_deliver'){if(!delivered){delivered=true;return {data:null,error:{message:'Respuesta perdida'}};}return {data:{id:args.p_id,total:100,paid:0,remaining:100},error:null};}
 })};
 render(<AssistantTripInvitations client={client}/>);fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));await screen.findByText('1. Primero');fireEvent.click(screen.getByRole('button',{name:'Atender cliente'}));await screen.findByText('Planilla de Primero');fireEvent.change(screen.getByLabelText('Entregar Agua'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar entrega y cobro'}));await screen.findByText('Respuesta perdida');
 fireEvent(window,new Event('focus'));await waitFor(()=>expect(screen.getByLabelText('Parada del recorrido').value).toBe('c1'));
 fireEvent.click(screen.getByRole('button',{name:'Reintentar misma entrega'}));await screen.findByText(/Entrega confirmada:/);const commands=client.rpc.mock.calls.filter(([n])=>n==='assistant_deliver').map(([,a])=>a);expect(commands[0]).toEqual(commands[1]);
});
