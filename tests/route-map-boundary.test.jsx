// @vitest-environment jsdom
import {lazy,Suspense,useEffect} from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {RouteMapBoundary} from '../src/features/RouteMapBoundary';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function Route({children}){return <><h3>Mi reparto</h3><RouteMapBoundary>{children}</RouteMapBoundary><button>Atender cliente</button><p>Lista de paradas disponible</p></>;}
it('conserva el reparto y sus acciones cuando falla la descarga del mapa',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});
 const BrokenMap=lazy(()=>Promise.reject(new Error('Failed to fetch dynamically imported module')));
 render(<Route><Suspense fallback={<p>Cargando</p>}><BrokenMap/></Suspense></Route>);
 expect(await screen.findByRole('alert')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Atender cliente'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Recargar reparto y reintentar'})).toBeTruthy();
 expect(screen.getByText('Lista de paradas disponible')).toBeTruthy();
});
it('contiene errores al inicializar el mapa sin ocultar las paradas',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});
 function BrokenMap(){useEffect(()=>{throw new Error('Map initialization failed');},[]);return <div/>;}
 render(<Route><BrokenMap/></Route>);
 expect(await screen.findByRole('alert')).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Mi reparto'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Atender cliente'})).toBeTruthy();
});
