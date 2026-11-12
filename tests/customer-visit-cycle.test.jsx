// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CustomerVisitCycle} from '../src/features/CustomerVisitCycle';
import {visitCycleDue,nextHabitualDate} from '../src/domain/visitPlanning';
import {TripCustomerPicker} from '../src/features/TripCustomerPicker';
afterEach(cleanup);
it('mantiene lunes y alterna semanas incluso al cambiar el año',()=>{
 const rule={every_weeks:2,anchor_date:'2026-11-02'};
 expect(visitCycleDue('2026-11-09',rule)).toBe(false);expect(visitCycleDue('2026-11-16',rule)).toBe(true);
 expect(nextHabitualDate([1],'2026-11-03',rule)).toBe('2026-11-16');expect(nextHabitualDate([1],'2026-11-03')).toBe('2026-11-09');
 expect(nextHabitualDate([1],'2026-12-30',{every_weeks:2,anchor_date:'2026-12-28'})).toBe('2027-01-11');
});
it('guarda frecuencia propia sin cambiar los días ni crear visitas',async()=>{
 const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:null,error:null})},rpc=vi.fn(async(_,args)=>({data:{every_weeks:args.p_weeks,anchor_date:args.p_anchor}})),saved=vi.fn();
 render(<CustomerVisitCycle client={{from:()=>chain,rpc}} tenantId="t" customerId="c" disabled={false} onLock={()=>{}} onSaved={saved}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Cada 15 días'}));fireEvent.change(screen.getByLabelText('Primera fecha de la semana de visita'),{target:{value:'2026-11-02'}});fireEvent.click(screen.getByText('Guardar frecuencia de visita'));
 await waitFor(()=>expect(saved).toHaveBeenCalled());expect(rpc).toHaveBeenCalledWith('owner_set_customer_visit_cycle',{p_tenant:'t',p_customer:'c',p_weeks:2,p_anchor:'2026-11-02'});
});
it('no sugiere el cliente en semana libre pero permite agregarlo manualmente',async()=>{
 const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:async()=>({data:[{customer_id:'a',weekday:1,every_weeks:2,anchor_date:'2026-11-02'},{customer_id:'b',weekday:1,every_weeks:1}],error:null})};
 render(<TripCustomerPicker client={{from:()=>chain}} tenantId="t" date="2026-11-09" customers={[{id:'a',name:'Alternado'},{id:'b',name:'Semanal'}]} windows={{}} windowsFailed={false}/>);
 await screen.findByLabelText(/Semanal/);expect(screen.queryByLabelText(/Alternado/)).toBeNull();fireEvent.click(screen.getByLabelText(/Mostrar también/));expect(screen.getByLabelText(/Alternado/)).toBeTruthy();
});

it('ofrece boton cada 21 dias y conserva la fecha de referencia al guardar',async()=>{
 const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null})},rpc=vi.fn(async(_,a)=>({data:{every_weeks:a.p_weeks,anchor_date:a.p_anchor}}));render(<CustomerVisitCycle client={{from:()=>query,rpc}} tenantId="t" customerId="c" disabled={false} onLock={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Cada 21 días'}));expect(screen.getByRole('button',{name:'Cada 21 días'}).getAttribute('aria-pressed')).toBe('true');expect(screen.getByRole('button',{name:'Cada 15 días'}).getAttribute('aria-pressed')).toBe('false');fireEvent.change(screen.getByLabelText('Primera fecha de la semana de visita'),{target:{value:'2026-11-02'}});fireEvent.click(screen.getByText('Guardar frecuencia de visita'));await waitFor(()=>expect(rpc).toHaveBeenCalledWith('owner_set_customer_visit_cycle',{p_tenant:'t',p_customer:'c',p_weeks:3,p_anchor:'2026-11-02'}));
 const rule={every_weeks:3,anchor_date:'2026-11-02'};expect(visitCycleDue('2026-11-09',rule)).toBe(false);expect(visitCycleDue('2026-11-16',rule)).toBe(false);expect(visitCycleDue('2026-11-23',rule)).toBe(true);expect(nextHabitualDate([1],'2026-11-03',rule)).toBe('2026-11-23');
});
