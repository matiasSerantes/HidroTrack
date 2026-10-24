// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OwnerLoadSuggestion } from '../src/features/OwnerLoadSuggestion';
afterEach(cleanup);
const products=[{id:'water',name:'Agua 20 L',unit:'unidad'},{id:'soda',name:'Soda',unit:'unidad'}];
function clientFixture(fail=false,extra=false){
 const calls=[];const records={route_stops:[{tenant_id:'a',trip_id:'route',active:true,customer_id:'c1'},{tenant_id:'a',trip_id:'route',active:true,customer_id:'c2'},{tenant_id:'a',trip_id:'route',active:true,customer_id:'c3'},{tenant_id:'b',trip_id:'route',active:true,customer_id:'foreign'}],customers:[{tenant_id:'a',id:'c1',active:true,pending_recovery:false},{tenant_id:'a',id:'c2',active:true,pending_recovery:true},{tenant_id:'a',id:'c3',active:true,pending_recovery:false}],customer_product_preferences:[{tenant_id:'a',customer_id:'c1',product_id:'water',quantity:2},{tenant_id:'a',customer_id:'c2',product_id:'water',quantity:7},{tenant_id:'b',customer_id:'foreign',product_id:'water',quantity:10}]};
 if(extra)records.extra_visit_requests=[{tenant_id:'a',trip_id:'route',state:'assigned',customer_id:'c1',items:[{product_id:'water',quantity:1}]}];
 const client={from:vi.fn(table=>{const filters=[];let start=0,end=999;calls.push({table,filters});const chain={select:()=>chain,order:()=>chain,range:(a,b)=>{start=a;end=b;return chain;},eq:(k,v)=>{filters.push([k,v,false]);return chain;},in:(k,v)=>{filters.push([k,v,true]);return chain;},then:(resolve,reject)=>{const data=(records[table]??[]).filter(row=>filters.every(([k,v,list])=>list?v.includes(row[k]):row[k]===v));return Promise.resolve({data:data.slice(start,end+1),count:data.length,error:fail?{message:'No disponible'}:null}).then(resolve,reject)}};return chain;})};return {client,calls};
}
it('suma solo clientes elegibles, muestra falta de habitos y permite extras',async()=>{
 const {client,calls}=clientFixture();render(<form><OwnerLoadSuggestion client={client} tenantId="a" tripId="route" products={products} available={()=>20}/></form>);
 const apply=await screen.findByRole('button',{name:'Usar carga sugerida'});expect(screen.getByText(/1 clientes sin cantidades/)).toBeTruthy();
 expect(screen.getByLabelText('Cargar Agua 20 L').value).toBe('0');fireEvent.click(apply);expect(screen.getByLabelText('Cargar Agua 20 L').value).toBe('2');
 fireEvent.change(screen.getByLabelText('Cargar Agua 20 L'),{target:{value:'5'}});expect(screen.getByText('Sugeridos: 2 · Extras: 3')).toBeTruthy();
 expect(new FormData(document.querySelector('form')).get('water')).toBe('5');expect(calls.every(c=>c.filters.some(([k,v])=>k==='tenant_id'&&v==='a'))).toBe(true);
});
it('si falla la consulta no inventa sugerencia y permite cantidad manual',async()=>{
 const {client}=clientFixture(true);render(<OwnerLoadSuggestion client={client} tenantId="a" tripId="route" products={products} available={()=>20}/>);
 await screen.findByText(/No pudimos calcular/);expect(screen.queryByRole('button',{name:'Usar carga sugerida'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Cargar Agua 20 L'),{target:{value:'4'}});expect(screen.getByText('4 unidades')).toBeTruthy();
});

it('pedido extraordinario reemplaza el habitual sin duplicar cantidades',async()=>{
 const {client}=clientFixture(false,true);render(<OwnerLoadSuggestion client={client} tenantId="a" tripId="route" products={products} available={()=>20}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Usar carga sugerida'}));expect(screen.getByLabelText('Cargar Agua 20 L').value).toBe('1');
});

it('preview solo incluye el faltante rellenado de productos con costo',async()=>{
 const {client}=clientFixture();const priced=[{id:'water',name:'Agua 20 L',unit:'unidad',returnable:true,family:'article'}];
 const view=render(<OwnerLoadSuggestion client={client} tenantId="a" tripId="route" products={priced} available={()=>20} depotReady={()=>2} fillOnLoad={true} fillingSettings={{enabled:true,costs:[{product_id:'water',unit_cost:100}]}}/>);
 await screen.findByRole('button',{name:'Usar carga sugerida'});
 fireEvent.change(screen.getByLabelText('Cargar Agua 20 L'),{target:{value:'5'}});expect(screen.getByText('Agua 20 L: 3 a rellenar')).toBeTruthy();
 view.rerender(<OwnerLoadSuggestion client={client} tenantId="a" tripId="route" products={priced} available={()=>20} depotReady={()=>2} fillOnLoad={false} fillingSettings={{enabled:true,costs:[{product_id:'water',unit_cost:100}]}}/>);
 expect(screen.queryByText('Agua 20 L: 3 a rellenar')).toBe(null);
});
