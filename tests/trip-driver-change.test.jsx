// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {TripDriverChange} from '../src/features/TripDriverChange';
import {seedProgram} from '../src/domain/programDemo';
import {changeDemoTripDriver} from '../src/domain/assistantDemo';
afterEach(cleanup);
it('reintenta el cambio incierto con el mismo chofer esperado y solicitud',async()=>{
 const client={rpc:vi.fn().mockResolvedValueOnce({error:{message:'Sin red'}}).mockImplementation(async(_,a)=>({data:a.p_id}))},changed=vi.fn();
 render(<TripDriverChange client={client} tenantId="t" trip={{id:'r',driver_id:'old',status:'planned'}} drivers={[{id:'new',name:'Nuevo chofer'}]} disabled={false} onLock={()=>{}} onChanged={changed}/>);
 fireEvent.change(screen.getByLabelText('Nuevo chofer del reparto'),{target:{value:'new'}});fireEvent.click(screen.getByText('Guardar nuevo chofer'));fireEvent.click(await screen.findByText('Reintentar mismo cambio de chofer'));await waitFor(()=>expect(changed).toHaveBeenCalled());expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);expect(client.rpc.mock.calls[0][1]).toMatchObject({p_expected:'old',p_driver:'new',p_trip:'r'});
});
it('no ofrece reasignar un reparto iniciado y demo exige nueva aceptación',()=>{
 render(<TripDriverChange client={{}} tenantId="t" trip={{id:'r',driver_id:'old',status:'active'}} drivers={[]} disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);expect(screen.queryByLabelText('Nuevo chofer del reparto')).toBeNull();
 const s=seedProgram(),t=s.trips.find(t=>t.stage==='planned'),driver=s.members.find(m=>m.active&&m.role==='driver'&&m.id!==t.driverId);const next=changeDemoTripDriver(s,'owner',t.id,driver.id);expect(next.trips.find(v=>v.id===t.id).acceptance).toBe('pending');expect(s.trips.find(v=>v.id===t.id).driverId).toBe(t.driverId);expect(()=>changeDemoTripDriver(s,'owner',s.trips.find(v=>v.stage==='active').id,driver.id)).toThrow(/antes de iniciar/);
});
