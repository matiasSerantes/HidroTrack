// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {OwnerSelfClose} from '../src/features/OwnerSelfClose';
import {OwnerRoutePanel} from '../src/features/OwnerRoutePanel';
afterEach(cleanup);
const quote={trip:{id:'r',name:'Ruta propia',date:'2026-10-24',status:'active'},cash:150,transfer:100,sales:200,pending_visits:0,equipment_count:0,pending_closure:false,stock:[{product_id:'p',name:'Agua',family:'article',ready:3,empties:1}],initial_load:[{product_id:'p',name:'Agua',loaded:5}],revision:{operations:3,payments:3,stops:[]}};
it('reintento conserva ID resumen y conteo ante respuesta perdida',async()=>{
 let attempts=0;const onDone=vi.fn(),onLock=vi.fn();const client={rpc:vi.fn(async(name,args)=>{if(name==='owner_route_templates')return {data:[],error:null};if(name==='owner_preview_trip_close')return {data:quote,error:null};return ++attempts===1?{data:null,error:{message:'Respuesta perdida'}}:{data:{...quote,id:args.p_id},error:null};})};
 render(<OwnerSelfClose client={client} tenantId="a" tripId="r" disabled={false} onLock={onLock} onDone={onDone}/>);fireEvent.click(screen.getByRole('button',{name:'Finalizar mi reparto'}));await screen.findByText('Conteo de regreso');fireEvent.click(screen.getByLabelText(/Revisé dinero/));fireEvent.click(screen.getByRole('button',{name:'Confirmar conteo y cerrar reparto'}));await screen.findByText('Respuesta perdida');expect(screen.getByLabelText('Efectivo contado ($)').closest('fieldset').disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo cierre'}));await waitFor(()=>expect(onDone).toHaveBeenCalledTimes(1));
 const commands=client.rpc.mock.calls.filter(([n])=>n==='owner_finish_self_trip').map(([,a])=>a);expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);expect(commands[0]).toMatchObject({p_expected:quote,p_cash:150,p_transfer:100,p_stock:[{product_id:'p',ready:3,empties:1}]});
});
it('rechazo del servidor obliga a actualizar el resumen sin confirmar cierre',async()=>{
 const onDone=vi.fn();const client={rpc:vi.fn(async name=>name==='owner_preview_trip_close'?{data:quote,error:null}:{data:null,error:{code:'P0001',message:'El reparto cambio'}})};
 render(<OwnerSelfClose client={client} tenantId="a" tripId="r" disabled={false} onLock={()=>{}} onDone={onDone}/>);fireEvent.click(screen.getByRole('button',{name:'Finalizar mi reparto'}));await screen.findByText('Conteo de regreso');fireEvent.click(screen.getByLabelText(/Revisé dinero/));fireEvent.click(screen.getByRole('button',{name:'Confirmar conteo y cerrar reparto'}));await screen.findByText('El reparto cambio');expect(screen.getByRole('button',{name:'Actualizar resumen de cierre'})).toBeTruthy();expect(onDone).not.toHaveBeenCalled();
});
it('clientes pendientes bloquean el formulario de cierre',async()=>{
 const client={rpc:vi.fn(async name=>({data:name==='owner_route_templates'?[]:{...quote,pending_visits:2},error:null}))};render(<OwnerSelfClose client={client} tenantId="a" tripId="r" disabled={false} onLock={()=>{}} onDone={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Finalizar mi reparto'}));await screen.findByText(/Quedan 2 clientes sin resultado/);expect(screen.getByRole('button',{name:'Confirmar conteo y cerrar reparto'}).closest('fieldset').disabled).toBe(true);expect(client.rpc.mock.calls.filter(([name])=>name==='owner_preview_trip_close')).toHaveLength(1);expect(client.rpc.mock.calls.filter(([name])=>name==='owner_finish_self_trip')).toHaveLength(0);
});
it('perder respuesta de cierre no desmonta el reintento al recuperar foco',async()=>{
 let closed=false,attempts=0;const client={rpc:vi.fn(async(name,args)=>{
  if(name==='owner_my_trips')return {data:closed?[]:[{id:'r',name:'Ruta propia',date:'2026-10-24',status:'active'}],error:null};
  if(name==='assistant_open_trip')return {data:{trip:quote.trip,stops:[],stock:[]},error:null};
  if(name==='owner_route_templates')return {data:[],error:null};if(name==='owner_preview_trip_close')return {data:quote,error:null};
  if(name==='owner_self_close_history')return {data:[],error:null};
  closed=true;return ++attempts===1?{data:null,error:{message:'Respuesta perdida'}}:{data:{...quote,id:args.p_id},error:null};
 })};
 render(<OwnerRoutePanel client={client} tenantId="a" userId="u" disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Abrir mi reparto'}));fireEvent.click(await screen.findByRole('button',{name:'Finalizar mi reparto'}));await screen.findByText('Conteo de regreso');fireEvent.click(screen.getByLabelText(/Revisé dinero/));fireEvent.click(screen.getByRole('button',{name:'Confirmar conteo y cerrar reparto'}));await screen.findByText('Respuesta perdida');fireEvent(window,new Event('focus'));expect(screen.getByRole('button',{name:'Reintentar mismo cierre'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo cierre'}));await screen.findByText(/Reparto cerrado/);const commands=client.rpc.mock.calls.filter(([n])=>n==='owner_finish_self_trip').map(([,a])=>a);expect(commands[0]).toEqual(commands[1]);
});
