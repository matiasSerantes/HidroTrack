// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {TripCustomerPicker} from '../src/features/TripCustomerPicker';
import {hasPlanningPoint} from '../src/domain/planningMap';
vi.mock('../src/features/TripPlanningMap',()=>({default:({customers,order,onSelect,disabled})=><section aria-label="Mapa simulado de planificación"><output>{order.join(',')}</output>{customers.filter(hasPlanningPoint).map(c=><button type="button" key={c.id} disabled={disabled} onClick={()=>onSelect(c.id)}>Punto {c.name}</button>)}</section>}));
afterEach(cleanup);
it('selección en mapa y orden de lista se guardan juntos sin crear el reparto',async()=>{
 const query={select:()=>query,eq:()=>query,order:()=>query,range:async()=>({data:[{customer_id:'a',weekday:1},{customer_id:'b',weekday:1},{customer_id:'c',weekday:1}],error:null})};
 const customers=[{id:'a',name:'Ana',latitude:-34,longitude:-58},{id:'b',name:'Bruno',latitude:-34.1,longitude:-58.1},{id:'c',name:'Sin punto'}];
 const {container}=render(<form><TripCustomerPicker client={{from:()=>query}} tenantId="t" date="2026-11-09" customers={customers} windows={{}} windowsFailed={false} canPersistOrder/></form>);
 await screen.findByLabelText(/Ana/);expect(screen.queryByRole('region',{name:'Mapa simulado de planificación'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Abrir mapa para organizar el reparto'}));fireEvent.click(await screen.findByRole('button',{name:'Punto Ana'}));fireEvent.click(screen.getByRole('button',{name:'Punto Bruno'}));
 fireEvent.click(screen.getByRole('button',{name:'Subir Bruno'}));expect(new FormData(container.querySelector('form')).getAll('customers')).toEqual(['b','a']);
 fireEvent.click(screen.getByRole('button',{name:'Punto Ana'}));await waitFor(()=>expect(new FormData(container.querySelector('form')).getAll('customers')).toEqual(['b']));
 expect(screen.getByText(/1 sin punto de mapa/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Punto Sin punto'})).toBeNull();
});
it('acepta cero como coordenada y descarta puntos incompletos o fuera de rango',()=>{
 expect(hasPlanningPoint({id:'a',name:'A',latitude:0,longitude:0})).toBe(true);expect(hasPlanningPoint({id:'a',name:'A',latitude:null,longitude:0})).toBe(false);expect(hasPlanningPoint({id:'a',name:'A',latitude:91,longitude:0})).toBe(false);
});
