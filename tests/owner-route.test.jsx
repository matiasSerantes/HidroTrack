// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {OwnerRoutePanel,ownerRouteKey} from '../src/features/OwnerRoutePanel';
afterEach(()=>{cleanup();localStorage.clear();});
const route={trip:{name:'Mi ruta',date:'2026-10-24',status:'active'},stops:[{id:'c1',name:'Cliente uno',address:'Calle 1',phone:'',position:1,outcome:'pending'},{id:'c2',name:'Cliente dos',address:'Calle 2',phone:'',position:2,outcome:'pending'}],stock:[]};
it('jefe abre sin aceptar invitacion y retoma parada guardando solo IDs de su cuenta',async()=>{
 const client={rpc:vi.fn(async name=>({data:name==='owner_my_trips'?[{id:'r',name:'Mi ruta',status:'active',date:'2026-10-24'}]:route,error:null}))};
 const first=render(<OwnerRoutePanel client={client} tenantId="a" userId="u" disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Abrir mi reparto'}));await screen.findByText('1. Cliente uno');expect(screen.queryByRole('button',{name:'Aceptar reparto'})).toBe(null);expect(screen.queryByRole('button',{name:'Agregar cliente durante el reparto'})).toBe(null);
 fireEvent.change(screen.getByLabelText('Parada del recorrido'),{target:{value:'c2'}});expect(JSON.parse(localStorage.getItem(ownerRouteKey('u','a')))).toEqual({trip:'r',stop:'c2'});first.unmount();render(<OwnerRoutePanel client={client} tenantId="a" userId="u" disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);await screen.findByText('2. Cliente dos');
});
it('cierre retira recorrido de la lista y oculta clientes al actualizar',async()=>{
 let closed=false;const client={rpc:vi.fn(async name=>({data:name==='owner_my_trips'?(closed?[]:[{id:'r',name:'Mi ruta',status:'active',date:'2026-10-24'}]):route,error:null}))};
 render(<OwnerRoutePanel client={client} tenantId="a" userId="u" disabled={false} onLock={()=>{}} onChanged={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Abrir mi reparto'}));await screen.findByText('1. Cliente uno');closed=true;fireEvent.click(screen.getByRole('button',{name:'Actualizar mis repartos'}));await waitFor(()=>expect(screen.queryByText('1. Cliente uno')).toBe(null));expect(localStorage.getItem(ownerRouteKey('u','a'))).toBe(null);
});
