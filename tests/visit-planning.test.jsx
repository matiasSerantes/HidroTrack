// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {argentinaClock,nextHabitualDate,addVisitDays} from '../src/domain/visitPlanning';
import {TripCustomerPicker} from '../src/features/TripCustomerPicker';
import {RouteTemplateTools} from '../src/features/RouteTemplateTools';
import {CustomerVisitSummary} from '../src/features/CustomerVisitSummary';
import {NextDayPlanning} from '../src/features/NextDayPlanning';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('fechas de mañana y días habituales respetan Argentina y cambio de mes',()=>{
 expect(argentinaClock(new Date('2026-10-28T00:00:00Z'))).toEqual({date:'2026-10-27',hour:21});
 expect(addVisitDays('2026-10-31',1)).toBe('2026-11-01');expect(nextHabitualDate([1],'2026-10-27')).toBe('2026-11-02');expect(nextHabitualDate([],'2026-10-27')).toBeNull();
});
it('revisa una plantilla, omite clientes inactivos y manda el orden manual en el formulario',async()=>{
 const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:async()=>({data:[],error:null})};
 const {container}=render(<form><TripCustomerPicker client={{from:()=>chain}} tenantId="t" date="2026-10-27" customers={[{id:'a',name:'Primero'},{id:'b',name:'Segundo'}]} windows={{}} windowsFailed={false} canPersistOrder seed={['b','gone','a']}/></form>);
 await screen.findByText(/Se omitieron clientes/);expect(new FormData(container.querySelector('form')).getAll('customers')).toEqual(['b','a']);
 fireEvent.click(screen.getByRole('button',{name:'Subir Primero'}));expect(new FormData(container.querySelector('form')).getAll('customers')).toEqual(['a','b']);
});
it('reintenta una plantilla con el mismo ID cuando la red pierde la confirmacion',async()=>{
 let tries=0;const client={rpc:vi.fn(async(name,args)=>name==='owner_route_templates'?{data:[],error:null}:++tries===1?{data:null,error:{message:'network'}}:{data:args.p_id,error:null})};
 render(<RouteTemplateTools client={client} tenantId="t" customers={['a','b']} disabled={false}/>);
 fireEvent.change(await screen.findByLabelText('Nombre de la plantilla'),{target:{value:'Lunes'}});fireEvent.click(screen.getByRole('button',{name:'Guardar como plantilla'}));
 fireEvent.click(await screen.findByRole('button',{name:'Reintentar misma plantilla'}));await screen.findByText(/Plantilla guardada en tu cuenta/);
 const calls=client.rpc.mock.calls.filter(([name])=>name==='owner_save_route_template');expect(calls).toHaveLength(2);expect(calls[0][1]).toEqual(calls[1][1]);
});
it('sin migracion no finge guardado local de plantillas',async()=>{
 const client={rpc:vi.fn(async()=>({data:null,error:{code:'PGRST202'}}))};render(<RouteTemplateTools client={client} tenantId="t" customers={['a']} disabled={false}/>);
 await waitFor(()=>expect(client.rpc).toHaveBeenCalled());expect(screen.queryByRole('button',{name:'Guardar como plantilla'})).toBeNull();
});
it('planilla muestra horario 24h y distingue fecha habitual de visita confirmada',async()=>{
 const client={from:table=>{const chain={select:()=>chain,eq:()=>chain,then:resolve=>Promise.resolve({data:[{weekday:1}],error:null}).then(resolve),maybeSingle:async()=>({data:{start_time:'08:30:00',end_time:'18:30:00'},error:null})};return chain;}};
 render(<CustomerVisitSummary client={client} tenantId="t" customerId="c" version={0}/>);
 await screen.findByText('Podés pasar de 08:30 a 18:30 (24 horas)');expect(screen.getByText(/no confirma una visita ni un recorrido/)).toBeTruthy();
});
it('mañana informa reparto existente y abre la fecha correcta sin crear uno automaticamente',async()=>{
 const prepare=vi.fn(),client={from:table=>{const data=table==='customer_schedules'?[{customer_id:'c'}]:table==='customers'?[{id:'c'}]:[{name:'Ruta mañana'}];const chain={select:()=>chain,eq:()=>chain,order:()=>chain,in:()=>chain,range:()=>chain,then:resolve=>Promise.resolve({data,error:null}).then(resolve)};return chain;}};
 render(<NextDayPlanning client={client} tenantId="t" disabled={false} onPrepare={prepare}/>);
 await screen.findByText(/Ya hay repartos preparados: Ruta mañana/);expect(prepare).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Ver clientes y preparar mañana'}));expect(prepare).toHaveBeenCalledWith(addVisitDays(argentinaClock().date,1));
});
