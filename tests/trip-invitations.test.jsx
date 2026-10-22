// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantTripInvitations, OwnerTripInvitations } from '../src/features/TripInvitations';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
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
 fireEvent.click(accept);fireEvent.click(await screen.findByRole('button',{name:'Ver recorrido'}));
 expect(await screen.findByText('1. Cliente asignado')).toBeTruthy();
});
it('elimina resumen visible si el jefe revoca al actualizar',async()=>{
 let state='accepted';const client={rpc:vi.fn(async(name)=>name==='assistant_trip_invitations'?{data:[{...invitation,state}],error:null}:{data:{trip:{name:'Resumen aceptado'},stops:[]},error:null})};
 render(<AssistantTripInvitations client={client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Ver recorrido'}));await screen.findByText('Resumen aceptado');
 state='revoked';fireEvent.click(screen.getByRole('button',{name:'Actualizar recorridos'}));
 await waitFor(()=>expect(screen.queryByText('Resumen aceptado')).toBe(null));
 expect(screen.queryByRole('button',{name:'Ver recorrido'})).toBe(null);
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
