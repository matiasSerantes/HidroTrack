// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {OwnerFollowupInbox} from '../src/features/OwnerFollowupInbox';
afterEach(cleanup);
const item={trip_id:'source',customer_id:'c',customer:'Cliente de prueba',address:'Calle de prueba',version:2,next_date:'2026-01-01',trip:'Ruta anterior',trip_status:'closed',note:'Volver por la tarde'};
it('traslado conserva comando para reintentar y no agrega stock desde la interfaz',async()=>{
 let attempts=0,finished=false;const client={rpc:vi.fn(async(name,args)=>{if(name==='owner_followup_inbox')return {data:{count:finished?0:1,items:finished?[]:[item]},error:null};if(++attempts===1)return {data:null,error:{message:'Sin respuesta'}};finished=true;return {data:{id:args.p_id},error:null};})};
 render(<OwnerFollowupInbox client={client} tenantId="a" trips={[{id:'target',name:'Ruta nueva',status:'planned',service_date:'2099-01-01'}]} disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);
 await screen.findByText('Cliente de prueba');fireEvent.change(screen.getByLabelText('Reparto de destino'),{target:{value:'target'}});fireEvent.click(screen.getByRole('button',{name:'Asignar a otro reparto'}));await screen.findByText('Sin respuesta');fireEvent.click(screen.getByRole('button',{name:'Reintentar mismo pendiente'}));await screen.findByText(/Pendiente trasladado/);
 const commands=client.rpc.mock.calls.filter(([n])=>n==='owner_manage_followup').map(([,a])=>a);expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);expect(commands[0]).toMatchObject({p_source_trip:'source',p_target_trip:'target',p_version:2,p_action:'assign'});expect(client.rpc.mock.calls.some(([n])=>n.includes('inventory'))).toBe(false);
});
it('cerrar exige motivo y envia resolucion sin reparto de destino',async()=>{
 const client={rpc:vi.fn(async(name,args)=>({data:name==='owner_followup_inbox'?{count:1,items:[item]}:{id:args.p_id},error:null}))};
 render(<OwnerFollowupInbox client={client} tenantId="a" trips={[]} disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Cerrar pendiente con motivo'}));await screen.findByText('Escribí el motivo para cerrar el pendiente.');expect(client.rpc.mock.calls.filter(([n])=>n==='owner_manage_followup')).toHaveLength(0);
 fireEvent.change(screen.getByLabelText('Motivo o nota'),{target:{value:'Atendido por el jefe'}});fireEvent.click(screen.getByRole('button',{name:'Cerrar pendiente con motivo'}));await waitFor(()=>expect(client.rpc.mock.calls.some(([n,a])=>n==='owner_manage_followup'&&a.p_action==='resolve'&&a.p_target_trip===null&&a.p_note==='Atendido por el jefe')).toBe(true));
});
it('error de lectura oculta la lista previa para no decidir con datos sin verificar',async()=>{
 let fail=false;const client={rpc:vi.fn(async()=>fail?{data:null,error:{message:'Sin acceso'}}:{data:{count:1,items:[item]},error:null})};
 render(<OwnerFollowupInbox client={client} tenantId="a" trips={[]} disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);await screen.findByText('Cliente de prueba');fail=true;fireEvent.click(screen.getByRole('button',{name:'Actualizar pendientes'}));await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Cerrar pendiente con motivo'})).toBe(null);expect(screen.queryByText('Calle de prueba')).toBe(null);
});
