// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {TripCustomerPicker,orderedVisitCustomers,visitWeekday} from '../src/features/TripCustomerPicker';
afterEach(cleanup);
const customers=[{id:'free',name:'Sin franja'},{id:'late',name:'Tarde'},{id:'early',name:'Temprano'},{id:'other',name:'Otro dia'}];
const windows={late:{start_time:'16:00',end_time:'17:00'},early:{start_time:'08:30',end_time:'09:00'}};
it('calcula lunes y domingo sin depender del huso del dispositivo y ordena sin mutar',()=>{
 expect(visitWeekday('2026-10-26')).toBe(1);expect(visitWeekday('2026-11-01')).toBe(7);
 expect(orderedVisitCustomers(customers,windows).map(c=>c.id)).toEqual(['early','late','other','free']);expect(customers[0].id).toBe('free');
});
it('filtra lunes, muestra excepciones y conserva seleccion en orden horario para el formulario',async()=>{
 const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:async()=>({data:[{customer_id:'free',weekday:1},{customer_id:'late',weekday:1},{customer_id:'early',weekday:1},{customer_id:'other',weekday:2}],error:null})};
 const {container}=render(<form><TripCustomerPicker client={{from:()=>chain}} tenantId="t" date="2026-10-26" customers={customers} windows={windows} windowsFailed={false}/></form>);
 const early=await screen.findByLabelText(/Temprano/);expect(screen.queryByText('Otro dia')).toBeNull();
 expect(screen.getAllByRole('checkbox').slice(1).map(n=>n.parentElement.textContent)).toEqual([expect.stringContaining('Temprano'),expect.stringContaining('Tarde'),expect.stringContaining('Sin franja')]);
 fireEvent.click(screen.getByLabelText(/Tarde/));fireEvent.click(early);
 fireEvent.click(screen.getByLabelText(/Mostrar tambi/));fireEvent.click(screen.getByLabelText(/Otro dia/));fireEvent.click(screen.getByLabelText(/Mostrar tambi/));
 expect(new FormData(container.querySelector('form')).getAll('customers')).toEqual(['early','late','other']);
 expect(screen.getByText(/incluye clientes ocultos/)).toBeTruthy();
});
it('si falla la consulta muestra todos sin afirmar que pertenecen al dia',async()=>{
 const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:async()=>({data:null,error:new Error()})};
 render(<TripCustomerPicker client={{from:()=>chain}} tenantId="t" date="2026-10-26" customers={customers} windows={windows} windowsFailed={false}/>);
 await screen.findByRole('alert');expect(screen.getByLabelText(/Otro dia/)).toBeTruthy();
});
