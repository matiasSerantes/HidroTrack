// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {RouteChangeAlerts} from '../src/features/RouteChangeAlerts';
import {readRouteChangeLink} from '../src/domain/routeChangeLink';
afterEach(cleanup);
it('consulta cambios de su recorrido, actualiza y marca solo avisos visibles',async()=>{
 const onChanged=vi.fn(),rpc=vi.fn(async name=>({data:name==='assistant_route_changes'?{available:true,push_enabled:false,unread:1,items:[{id:'event',kind:'stop_removed',position:1,customer:'Cliente ficticio',created_at:'2026-10-30T12:00:00Z',read_at:null}]}:null,error:null}));
 render(<RouteChangeAlerts client={{rpc}} tenantId="company" tripId="trip" disabled={false} onChanged={onChanged}/>);
 expect(await screen.findByText('Parada retirada · Nuevo')).toBeTruthy();expect(rpc).toHaveBeenCalledWith('assistant_route_changes',{p_tenant:'company',p_trip:'trip'});
 fireEvent.click(screen.getByRole('button',{name:'Actualizar recorrido'}));expect(onChanged).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Marcar estos avisos como leídos'}));await waitFor(()=>expect(rpc).toHaveBeenCalledWith('assistant_read_route_changes',{p_tenant:'company',p_trip:'trip',p_ids:['event']}));
});
it('error de permiso oculta nombres y no muestra saldo de avisos como cero',async()=>{
 const rpc=vi.fn(async()=>({data:null,error:{code:'42501'}}));render(<RouteChangeAlerts client={{rpc}} tenantId="company" tripId="trip" disabled={false}/>);
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('0 avisos sin leer.')).toBeNull();
});
it('enlace de cambio solo admite ids validos y no concede acceso por si solo',()=>{
 const tenant='10000000-0000-0000-0000-000000000001',trip='20000000-0000-0000-0000-000000000001';
 expect(readRouteChangeLink(`?cambios=1&empresa=${tenant}&recorrido=${trip}`)).toEqual({tenant,trip});
 expect(readRouteChangeLink('?cambios=1&empresa=xxx&recorrido=https://malicious.test')).toBeNull();
});
