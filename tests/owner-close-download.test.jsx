// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {OwnerCloseHistory} from '../src/features/OwnerSelfClose';
import {downloadOwnerClosePdf} from '../src/domain/ownerCloseReceipt';
vi.mock('../src/domain/ownerCloseReceipt',()=>({downloadOwnerClosePdf:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const snapshot={id:'c',closed_at:'2026-10-25T19:00:00Z',trip:{id:'r',name:'Ruta ficticia',date:'2026-10-25',status:'closed'},cash:100,transfer:20,sales:100,initial_load:[],stock:[]};
it('ofrece acceso explicito a repartos finalizados y permite abrir su PDF',async()=>{
 const client={rpc:vi.fn(async()=>({data:[snapshot],error:null}))};render(<OwnerCloseHistory client={client} tenantId="a" refreshKey={0}/>);
 expect(screen.getByRole('heading',{name:'Repartos finalizados'})).toBeTruthy();expect(client.rpc).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Ver repartos finalizados y PDF'}));expect(await screen.findByRole('button',{name:'Descargar PDF del cierre'})).toBeTruthy();
});
it('revalida acceso y descarga el snapshot del servidor sin escribir movimientos',async()=>{
 const client={rpc:vi.fn(async()=>({data:[snapshot],error:null}))};render(<OwnerCloseHistory client={client} tenantId="a" open refreshKey={0}/>);fireEvent.click(await screen.findByRole('button',{name:'Descargar PDF del cierre'}));await waitFor(()=>expect(downloadOwnerClosePdf).toHaveBeenCalledWith(snapshot,'a'));expect(client.rpc.mock.calls).toEqual([['owner_self_close_history',{p_tenant:'a'}],['owner_self_close_history',{p_tenant:'a'}]]);
});
it('si perdió acceso no descarga el snapshot viejo y permite reintentar',async()=>{
 let calls=0;const client={rpc:vi.fn(async()=>++calls===2?{data:null,error:{code:'42501'}}:{data:[snapshot],error:null})};render(<OwnerCloseHistory client={client} tenantId="a" open refreshKey={0}/>);fireEvent.click(await screen.findByRole('button',{name:'Descargar PDF del cierre'}));await screen.findByRole('alert');expect(downloadOwnerClosePdf).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Descargar PDF del cierre'}));await waitFor(()=>expect(downloadOwnerClosePdf).toHaveBeenCalledTimes(1));
});
it('salir de la cuenta durante la consulta cancela la descarga',async()=>{
 let resolve;const client={rpc:vi.fn().mockResolvedValueOnce({data:[snapshot],error:null}).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}))};const view=render(<OwnerCloseHistory client={client} tenantId="a" open refreshKey={0}/>);fireEvent.click(await screen.findByRole('button',{name:'Descargar PDF del cierre'}));view.unmount();resolve({data:[snapshot],error:null});await new Promise(r=>setTimeout(r,30));expect(downloadOwnerClosePdf).not.toHaveBeenCalled();
});
