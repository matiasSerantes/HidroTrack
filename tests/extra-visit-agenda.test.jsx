// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ExtraVisitAgenda} from '../src/features/ExtraVisitAgenda';
afterEach(cleanup);
it('muestra hora, cliente y pedido y abre fecha sin crear reparto',async()=>{
 const prepare=vi.fn(),filters=[];const chain={select:()=>chain,eq:(k,v)=>{filters.push([k,v]);return chain;},gte:(k,v)=>{filters.push([k,v]);return chain;},lte:(k,v)=>{filters.push([k,v]);return chain;},order:()=>chain,range:async()=>({data:[{id:'a',customer_name:'Cliente ficticio',address:'Calle 100',requested_on:'2026-11-09',requested_time:'18:30:00',state:'pending',trip_name:null,note:'Pidió antes del lunes',items:[{quantity:2}]}],error:null})};
 render(<ExtraVisitAgenda client={{from:()=>chain}} tenantId="t" today="2026-11-08" disabled={false} onPrepare={prepare}/>);
 await screen.findByText('18:30 · Cliente ficticio');expect(screen.getByText(/2 unidades solicitadas/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Preparar reparto para mañana'}));expect(prepare).toHaveBeenCalledWith('2026-11-09');expect(filters).toContainEqual(['tenant_id','t']);expect(filters).toContainEqual(['requested_on','2026-11-08']);
});
