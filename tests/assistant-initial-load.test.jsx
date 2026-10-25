// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssistantInitialLoad} from '../src/features/AssistantInitialLoad';
import {AssistantTripInvitations} from '../src/features/TripInvitations';
afterEach(()=>{cleanup();localStorage.clear();});
const options={date:'2026-10-25',products:[{id:'p',name:'Agua',unit:'unidad',family:'article',returnable:true,ready:2,empties:8,suggested:3}]};
function chooseLoad(){fireEvent.click(screen.getByRole('button',{name:'Usar carga sugerida'}));fireEvent.change(screen.getByLabelText('Cargar Agua'),{target:{value:'4'}});fireEvent.click(screen.getByLabelText('Rellenar los vacíos necesarios para esta carga'));fireEvent.click(screen.getByLabelText('Revisé la carga física y confirmo estas cantidades.'));fireEvent.click(screen.getByRole('button',{name:'Registrar carga e iniciar reparto'}));}
it('sugerencia mas extras envia solo cantidades y fecha, y conserva mismo comando tras respuesta perdida',async()=>{
 let attempts=0;const onDone=vi.fn();const client={rpc:vi.fn(async(name,args)=>name==='assistant_load_options'?{data:options,error:null}:++attempts===1?{data:null,error:{message:'Respuesta perdida'}}:{data:args.p_id,error:null})};
 render(<AssistantInitialLoad client={client} tenantId="a" tripId="r" disabled={false} onLock={()=>{}} onDone={onDone}/>);await screen.findByLabelText('Cargar Agua');chooseLoad();await screen.findByText('Respuesta perdida');expect(screen.getByLabelText('Cargar Agua').closest('fieldset').disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Reintentar misma carga'}));await waitFor(()=>expect(onDone).toHaveBeenCalledTimes(1));const calls=client.rpc.mock.calls.filter(([n])=>n==='assistant_confirm_load').map(([,a])=>a);expect(calls[0]).toEqual(calls[1]);expect(calls[0]).toMatchObject({p_tenant:'a',p_trip:'r',p_items:[{product_id:'p',quantity:4}],p_date:'2026-10-25',p_fill:true});expect(calls[0]).not.toHaveProperty('unit_cost');expect(screen.queryByRole('button',{name:'Registrar carga e iniciar reparto'})).toBe(null);
});
it('rechazo confirmado exige consultar opciones actuales antes de otra carga',async()=>{
 const client={rpc:vi.fn(async name=>name==='assistant_load_options'?{data:options,error:null}:{data:null,error:{code:'P0001',message:'Stock insuficiente'}})};const onDone=vi.fn();render(<AssistantInitialLoad client={client} tenantId="a" tripId="r" disabled={false} onLock={()=>{}} onDone={onDone}/>);await screen.findByLabelText('Cargar Agua');chooseLoad();await screen.findByText('Stock insuficiente');expect(screen.queryByLabelText('Cargar Agua')).toBe(null);expect(screen.getByRole('button',{name:'Actualizar carga disponible'})).toBeTruthy();expect(onDone).not.toHaveBeenCalled();
});
it('sin productos y sin datos verificados no ofrece confirmacion de carga',async()=>{
 const client={rpc:vi.fn(async()=>({data:null,error:{code:'42501'}}))};render(<AssistantInitialLoad client={client} tenantId="a" tripId="r" disabled={false} onLock={()=>{}} onDone={()=>{}}/>);await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Registrar carga e iniciar reparto'})).toBe(null);
});
it('actualizacion por foco no pierde un reintento aunque servidor ya haya activado el reparto',async()=>{
 let active=false,attempts=0;const invitation={tenant_id:'a',trip_id:'r',name:'Ruta ficticia',date:'2026-10-25',state:'accepted',company:'Empresa ficticia',chief:'Jefe ficticio'};const client={rpc:vi.fn(async(name,args)=>{
  if(name==='assistant_trip_invitations')return {data:[{...invitation,status:active?'active':'planned'}],error:null};
  if(name==='assistant_open_trip')return {data:{trip:{name:'Ruta ficticia',date:'2026-10-25',status:active?'active':'planned'},stops:[],stock:[]},error:null};
  if(name==='assistant_load_options')return {data:options,error:null};
  active=true;return ++attempts===1?{data:null,error:{message:'Respuesta perdida'}}:{data:args.p_id,error:null};
 })};
 render(<AssistantTripInvitations client={client} userId="u"/>);fireEvent.click(await screen.findByRole('button',{name:'Abrir reparto'}));await screen.findByLabelText('Cargar Agua');chooseLoad();await screen.findByText('Respuesta perdida');fireEvent(window,new Event('focus'));expect(screen.getByRole('button',{name:'Reintentar misma carga'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Reintentar misma carga'}));await screen.findByText('En recorrido');expect(screen.queryByRole('button',{name:'Registrar carga e iniciar reparto'})).toBe(null);expect(client.rpc.mock.calls.filter(([n])=>n==='assistant_confirm_load')).toHaveLength(2);
});
