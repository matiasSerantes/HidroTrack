// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {AdminAccountUsage} from '../src/features/AdminAccountUsage';
import {AdminWorkspace} from '../src/features/AdminWorkspace';
afterEach(()=>{cleanup();vi.restoreAllMocks();window.history.replaceState(null,'','/');});
it('acceso directo abre uso y muestra inventario separado de recorridos en demo',async()=>{
 window.history.replaceState(null,'','/?admin=uso');render(<AdminWorkspace demo/>);
 const panel=await screen.findByRole('region',{name:'Uso por cuenta'});
 expect(within(panel).getByText('El stock es actual.')).toBeTruthy();
 expect((await within(panel).findAllByText('Unidades registradas')).length).toBeGreaterThan(0);
 expect(within(panel).getAllByText('Creados ese día').length).toBeGreaterThan(0);
});
it('fecha y busqueda se envian al RPC con pagina inicial y no muestran ceros ante error',async()=>{
 const rpc=vi.fn(async(_name,args)=>({data:{date:args.p_date,generated_at:new Date().toISOString(),count:0,items:[]},error:null}));render(<AdminAccountUsage client={{rpc}}/>);
 await screen.findByText(/0 cuentas/);fireEvent.change(screen.getByLabelText('Fecha de los recorridos'),{target:{value:'2026-10-25'}});
 await waitFor(()=>expect(rpc).toHaveBeenCalledWith('admin_account_usage',expect.objectContaining({p_date:'2026-10-25',p_offset:0})));
 fireEvent.change(screen.getByLabelText('Empresa o correo del jefe'),{target:{value:'Agua norte'}});fireEvent.click(screen.getByRole('button',{name:'Buscar cuenta'}));
 await waitFor(()=>expect(rpc).toHaveBeenCalledWith('admin_account_usage',{p_date:'2026-10-25',p_offset:0,p_search:'Agua norte'}));
 rpc.mockResolvedValue({data:null,error:{message:'offline'}});fireEvent.click(screen.getByRole('button',{name:'Actualizar estadísticas'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText(/0 cuentas/)).toBeNull();
});
