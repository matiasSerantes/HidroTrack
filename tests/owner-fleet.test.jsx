// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {cleanup,render,screen,fireEvent,act} from '@testing-library/react';
vi.mock('../src/features/OwnerFleetMap',()=>({default:({items})=><div aria-label="Mapa simulado">Puntos: {items.length}</div>}));
import {OwnerFleet} from '../src/features/OwnerFleet';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const item={trip_id:'trip',trip_name:'Lunes',driver_id:'driver',driver_name:'Chofer ficticio',total:10,attended:2,latitude:-34.6,longitude:-58.4,accuracy:15,customer:'Parada ficticia'};
it('una respuesta demorada no convierte un punto vencido en una ubicacion reciente',async()=>{
 const initial=Date.now();let clock=initial,finish;vi.spyOn(Date,'now').mockImplementation(()=>clock);
 const reply=new Promise(resolve=>{finish=resolve;}),rpc=vi.fn(()=>reply);render(<OwnerFleet client={{rpc}} tenantId="company"/>);
 clock+=120000;await act(async()=>finish({data:{server_now:new Date(initial).toISOString(),items:[{...item,updated_at:new Date(initial).toISOString()}]},error:null}));
 expect(screen.getByText('Sin ubicación reciente')).toBeTruthy();expect(screen.queryByLabelText('Mapa simulado')).toBeNull();
});
it('consulta su empresa, muestra progreso y retira puntos al perder acceso',async()=>{
 let items=[{...item,updated_at:new Date().toISOString()}];const rpc=vi.fn(async()=>({data:{server_now:new Date().toISOString(),items},error:null}));
 render(<OwnerFleet client={{rpc}} tenantId="company"/>);
 expect(await screen.findByText('Puntos: 1')).toBeTruthy();expect(screen.getByText('2 de 10 clientes atendidos')).toBeTruthy();expect(rpc).toHaveBeenCalledWith('owner_live_trip_positions',{p_tenant:'company'});
 items=[];fireEvent.click(screen.getByRole('button',{name:'Actualizar ubicaciones'}));expect(await screen.findByText('Todavía no hay asistentes con un reparto activo aceptado.')).toBeTruthy();expect(screen.queryByLabelText('Mapa simulado')).toBeNull();
});
it('no muestra ubicacion vieja como actual ni revela parada sin señal reciente',async()=>{
 const rpc=vi.fn(async()=>({data:{server_now:new Date().toISOString(),items:[{...item,updated_at:new Date(Date.now()-120000).toISOString()}]},error:null}));render(<OwnerFleet client={{rpc}} tenantId="company"/>);
 expect(await screen.findByText('Sin ubicación reciente')).toBeTruthy();expect(screen.queryByLabelText('Mapa simulado')).toBeNull();expect(screen.queryByText(/Parada seleccionada:/)).toBeNull();
});
