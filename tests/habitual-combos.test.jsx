// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {OwnerCustomerHabits} from '../src/features/OwnerCustomerHabits';
import {routeLoadSuggestion} from '../src/domain/routeLoadDemo';
import {seedProgram} from '../src/domain/programDemo';
afterEach(cleanup);
it('guarda una promo por visita, no dos unidades de otro producto',async()=>{
 const writes=[];const records={customer_schedules:[],customer_product_preferences:[],customer_combo_preferences:[],products:[{id:'b12',name:'Bidón 12',family:'article',active:true}],sale_combos:[{id:'promo',name:'Dos de 12 al precio pactado',active:true,version:1,price:6000,items:[{product_id:'b12',quantity:2}]}]};
 const client={from:table=>{let value,single=false,remove=false;const chain={select:()=>chain,eq:()=>chain,order:()=>chain,single:()=>{single=true;return chain;},maybeSingle:()=>{single=true;return chain;},delete:()=>{remove=true;return chain;},upsert:v=>{value=v;return chain;},then:resolve=>{if(value)writes.push({table,value});return Promise.resolve({data:value||(single?null:records[table]||[]),error:null}).then(resolve);}};return chain;}};
 render(<OwnerCustomerHabits client={client} tenantId="t" customerId="c" disabled={false} onLock={()=>{}}/>);
 await screen.findByText('Lo que suele pedir');fireEvent.change(screen.getByLabelText('Producto habitual'),{target:{value:'combo:promo'}});fireEvent.change(screen.getByLabelText('Promos por visita'),{target:{value:'1'}});fireEvent.click(screen.getByText('Guardar cantidad habitual'));await screen.findByText('1 promos por visita');
 expect(writes).toEqual([{table:'customer_combo_preferences',value:{tenant_id:'t',customer_id:'c',combo_id:'promo',quantity:1}}]);expect(screen.getByText(/Promo habitual guardada/)).toBeTruthy();
});
it('demo expande promo a bidones y no modifica preferencias al calcular',()=>{
 const s=seedProgram(),client=s.clients.find(c=>c.active),p=s.products.find(p=>p.active&&p.kind==='sale');client.usualItems={};client.usualCombos={promo:1};s.saleCombos=[{id:'promo',name:'Dos bidones',price:6000,active:true,version:1,available:0,items:[{product_id:p.id,quantity:2}]}];const before=structuredClone(client);
 expect(routeLoadSuggestion(s,{stops:[{clientId:client.id,status:'pending'}]}).quantities[p.id]).toBe(2);expect(client).toEqual(before);
 s.extraVisits=[{id:'extra',productId:p.id,quantity:1}];expect(routeLoadSuggestion(s,{stops:[{clientId:client.id,status:'pending',extraVisitId:'extra'}]}).quantities[p.id]).toBe(1);
});
