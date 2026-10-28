// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {AdminRecycleBin} from '../src/features/AdminRecycleBin';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('permite probar la papelera ficticia sin llamar a Supabase',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);const client={rpc:vi.fn()};render(<AdminRecycleBin client={client} demo/>);
 await screen.findByText('Cliente de ejemplo');fireEvent.click(screen.getByRole('button',{name:'Recuperar'}));
 await screen.findByText('Recuperación de ejemplo. No se cambió ninguna cuenta real.');expect(client.rpc).not.toHaveBeenCalled();
});
it('no ofrece recuperar un registro vencido y muestra fallo de consulta',async()=>{
 const client={rpc:vi.fn(async()=>({data:{count:1,items:[{id:'1',kind:'customer',label:'Cliente',company:'Empresa',deleted_by:'Jefe',deleted_at:'2026-01-01',expires_at:'2026-01-11',recoverable:false}]},error:null}))};
 const {unmount}=render(<AdminRecycleBin client={client}/>);expect((await screen.findByRole('button',{name:'Plazo vencido'})).disabled).toBe(true);expect(screen.queryByRole('button',{name:'Recuperar'})).toBeNull();
 unmount();render(<AdminRecycleBin client={{rpc:vi.fn(async()=>({data:null,error:{message:'offline'}}))}}/>);expect(await screen.findByRole('alert')).toBeTruthy();
});
it('recuperar requiere confirmacion y utiliza solo el ID privado del registro',async()=>{
 const item={id:'trash-id',kind:'trip',label:'Recorrido',company:'Empresa',deleted_by:'Jefe',deleted_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),recoverable:true};
 const client={rpc:vi.fn(async(name)=>name==='admin_recycle_bin'?{data:{count:1,items:[item]},error:null}:{data:'entity-id',error:null})};
 vi.spyOn(window,'confirm').mockReturnValue(false);render(<AdminRecycleBin client={client}/>);fireEvent.click(await screen.findByRole('button',{name:'Recuperar'}));expect(client.rpc).not.toHaveBeenCalledWith('admin_restore_removed',expect.anything());
 window.confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Recuperar'}));await waitFor(()=>expect(client.rpc).toHaveBeenCalledWith('admin_restore_removed',{p_id:'trash-id'}));
});
