// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {ShareTripLocation} from '../src/features/ShareTripLocation';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function fixture({startResult,waitStart}={}){
 Object.defineProperty(document,'hidden',{value:false,configurable:true});let sample;
 const geolocation={watchPosition:vi.fn(success=>{sample=success;return 7;}),clearWatch:vi.fn(),getCurrentPosition:vi.fn()};vi.stubGlobal('navigator',{geolocation});
 const rpc=vi.fn(async name=>name==='assistant_start_trip_sharing'?waitStart?waitStart:{data:startResult??{sharing:true},error:null}:name==='assistant_publish_trip_position'?{data:{updated:true},error:null}:{data:null,error:null});
 const view=render(<ShareTripLocation client={{rpc}} tenantId="company" tripId="trip" customerId="customer"/>);
 return {rpc,geolocation,view,position:()=>sample({coords:{latitude:-34.6,longitude:-58.4,accuracy:10},timestamp:Date.now()})};
}
it('solo comparte tras permiso explicito, confirma servidor y descarta nuevas lecturas al detener',async()=>{
 const v=fixture();expect(v.geolocation.watchPosition).not.toHaveBeenCalled();expect(v.rpc).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación con mi jefe'}));await waitFor(()=>expect(v.geolocation.watchPosition).toHaveBeenCalledTimes(1));
 await act(async()=>v.position());expect(await screen.findByText('Ubicación compartida con tu jefe. Se actualiza mientras este mapa está visible.')).toBeTruthy();
 expect(v.rpc).toHaveBeenCalledWith('assistant_publish_trip_position',expect.objectContaining({p_tenant:'company',p_trip:'trip',p_customer:'customer',p_latitude:-34.6}));
 fireEvent.click(screen.getByRole('button',{name:'Dejar de compartir ubicación'}));expect(v.geolocation.clearWatch).toHaveBeenCalledWith(7);
 const writes=v.rpc.mock.calls.filter(([name])=>name==='assistant_publish_trip_position').length;await act(async()=>v.position());expect(v.rpc.mock.calls.filter(([name])=>name==='assistant_publish_trip_position')).toHaveLength(writes);
});
it('ocultar mapa detiene el GPS y el envio no se reactiva solo al volver',async()=>{
 const v=fixture();fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación con mi jefe'}));await waitFor(()=>expect(v.geolocation.watchPosition).toHaveBeenCalled());
 Object.defineProperty(document,'hidden',{value:true,configurable:true});fireEvent(document,new Event('visibilitychange'));
 expect(v.geolocation.clearWatch).toHaveBeenCalledWith(7);expect(screen.getByRole('button',{name:'Compartir ubicación con mi jefe'})).toBeTruthy();
 expect(v.rpc).toHaveBeenCalledWith('assistant_stop_trip_sharing',expect.objectContaining({p_tenant:'company',p_trip:'trip'}));
 Object.defineProperty(document,'hidden',{value:false,configurable:true});fireEvent(document,new Event('visibilitychange'));expect(v.geolocation.watchPosition).toHaveBeenCalledTimes(1);
});
it('si se cierra durante la activacion, una respuesta tardia no inicia GPS y retira la sesion',async()=>{
 let finish;const waitStart=new Promise(resolve=>{finish=resolve;}),v=fixture({waitStart});
 fireEvent.click(screen.getByRole('button',{name:'Compartir ubicación con mi jefe'}));v.view.unmount();
 await act(async()=>finish({data:{sharing:true},error:null}));expect(v.geolocation.watchPosition).not.toHaveBeenCalled();expect(v.rpc.mock.calls.filter(([name])=>name==='assistant_stop_trip_sharing').length).toBeGreaterThan(0);
});
