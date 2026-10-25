// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssistantReceiptHistory,ReceiptDownload} from '../src/features/SharedCloseReceipts';
import {downloadSharedClosePdf} from '../src/domain/sharedCloseReceiptPdf';
vi.mock('../src/domain/sharedCloseReceiptPdf',()=>({downloadSharedClosePdf:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const receipt={id:'c',tenant_id:'a',company:'Empresa ficticia',driver:'Asistente ficticio',trip:{id:'r',name:'Ruta ficticia',date:'2026-10-25',status:'closed'},closure_state:'approved',declared_cash:100};
it('historial consulta solo recibos propios al abrir y revalida la descarga por ID',async()=>{
 const client={rpc:vi.fn(async name=>name==='assistant_close_receipts'?{data:[receipt],error:null}:{data:{role:'driver',receipt},error:null})};render(<AssistantReceiptHistory client={client}/>);expect(client.rpc).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Ver mis comprobantes'}));fireEvent.click(await screen.findByRole('button',{name:'Descargar mi PDF'}));await waitFor(()=>expect(downloadSharedClosePdf).toHaveBeenCalledWith(receipt,'driver'));expect(client.rpc.mock.calls).toEqual([['assistant_close_receipts'],['trip_close_receipt',{p_tenant:'a',p_id:'c'}]]);
});
it('rol o empresa distintos y acceso denegado impiden descargar; permite reintentar',async()=>{
 let attempts=0;const client={rpc:vi.fn(async()=>++attempts===1?{data:{role:'driver',receipt},error:null}:{data:{role:'owner',receipt},error:null})};render(<ReceiptDownload client={client} tenantId="a" id="c" role="owner"/>);fireEvent.click(screen.getByRole('button',{name:'Descargar PDF del jefe'}));await screen.findByRole('alert');expect(downloadSharedClosePdf).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Descargar PDF del jefe'}));await waitFor(()=>expect(downloadSharedClosePdf).toHaveBeenCalledWith(receipt,'owner'));
});
it('salir durante la consulta cancela descarga y doble toque no duplica solicitudes',async()=>{
 let resolve;const client={rpc:vi.fn(()=>new Promise(r=>{resolve=r;}))};const view=render(<ReceiptDownload client={client} tenantId="a" id="c" role="driver"/>);fireEvent.click(screen.getByRole('button',{name:'Descargar mi PDF'}));fireEvent.click(screen.getByRole('button',{name:'Preparando comprobante…'}));expect(client.rpc).toHaveBeenCalledTimes(1);view.unmount();resolve({data:{role:'driver',receipt},error:null});await new Promise(r=>setTimeout(r,30));expect(downloadSharedClosePdf).not.toHaveBeenCalled();
});
it('error al actualizar quita botones de datos antiguos sin permitir descarga stale',async()=>{
 let fail=false;const client={rpc:vi.fn(async()=>fail?{data:null,error:{code:'42501'}}:{data:[receipt],error:null})};render(<AssistantReceiptHistory client={client}/>);fireEvent.click(screen.getByRole('button',{name:'Ver mis comprobantes'}));await screen.findByRole('button',{name:'Descargar mi PDF'});fail=true;fireEvent.click(screen.getByRole('button',{name:'Actualizar comprobantes'}));await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Descargar mi PDF'})).toBe(null);expect(downloadSharedClosePdf).not.toHaveBeenCalled();
});
