// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {OwnerSaleCombos} from '../src/features/OwnerSaleCombos';
import {AssistantVisit} from '../src/features/AssistantVisit';
import {comboDelivery} from '../src/domain/saleCombos';
import {seedProgram,recordVisit,loadTrip} from '../src/domain/programDemo';
afterEach(cleanup);
const combo={id:'promo',name:'Doble agua',price:150,active:true,version:1,available:2,items:[{product_id:'p',quantity:2}]};
const product={id:'p',name:'Agua',price:100,active:true,ready:5,held:2,returnable:true};
it('sumatoria de combos solapados y sueltos rechaza stock insuficiente',()=>{
 expect(()=>comboDelivery([product],{p:{quantity:2,returned:0}},[combo,{...combo,id:'otra'}],{promo:1,otra:1})).toThrow(/stock/);
 expect(comboDelivery([product],{p:{quantity:1,returned:1}},[combo],{promo:1})).toMatchObject({total:25000,items:[{quantity:3,returned:1}]});
});
it('atencion suma combo mas suelto y reintenta el mismo comando sin doble carga',async()=>{
 let attempts=0;const commands=[];const client={rpc:vi.fn(async(name,args)=>{if(name==='assistant_customer_visit')return {data:{customer:{id:'c',name:'Cliente',pending_recovery:false},version:1,outcome:'pending',balance:0,products:[product],equipment:[],combos:[combo]},error:null};if(name!=='assistant_deliver_with_combos')throw new Error('RPC inesperada');commands.push(args);if(++attempts===1)return {error:{message:'Red cortada'}};return {data:{id:args.p_id,total:250,paid:250,remaining:0,credit_status:'paid'},error:null};})};
 render(<AssistantVisit client={client} tenantId="t" tripId="r" customerId="c" resolved={false} onLock={()=>{}} onChanged={()=>{}}/>);
 fireEvent.click(screen.getByText('Atender cliente'));await screen.findByText('Promociones disponibles');
 fireEvent.change(screen.getByLabelText('Combos de Doble agua'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('Entregar Agua'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('Devuelve Agua'),{target:{value:'1'}});
 expect(screen.getByText('Se bajan 3: 2 de promociones y 1 sueltos.')).toBeTruthy();expect(screen.getByText('Quedarán 4 envases para la próxima visita.')).toBeTruthy();
 fireEvent.click(screen.getByText('Paga el total'));fireEvent.click(screen.getByText('Confirmar entrega y cobro'));await screen.findByText('Red cortada');fireEvent.click(screen.getByText('Reintentar misma entrega'));await screen.findByText(/Entrega confirmada/);
 expect(commands[0]).toEqual(commands[1]);expect(commands[0]).toMatchObject({p_items:[{product_id:'p',quantity:3,returned:1}],p_expected_total:250,p_paid:250,p_combos:[{id:'promo',version:1,quantity:1}]});
});
it('jefe crea combo una vez y mantiene ID al perder respuesta',async()=>{
 const calls=[];const client={from:()=>{const chain={select:()=>chain,eq:()=>chain,order:()=>chain,then:f=>Promise.resolve({data:[],error:null}).then(f)};return chain;},rpc:vi.fn(async(name,args)=>{calls.push([name,args]);return calls.length===1?{error:{message:'Sin respuesta'}}:{data:args.p_id,error:null};})};
 render(<OwnerSaleCombos client={client} tenantId="t" products={[{...product,family:'article'}]} balances={[{product_id:'p',depot_ready:10}]} disabled={false} onLock={()=>{}}/>);
 await waitFor(()=>expect(screen.getByText('Crear combo').disabled).toBe(false));fireEvent.click(screen.getByText('Crear combo'));fireEvent.change(screen.getByLabelText('Nombre del combo'),{target:{value:'Doble agua'}});fireEvent.change(screen.getByLabelText('Precio del combo ($)'),{target:{value:'150'}});fireEvent.change(screen.getByLabelText('Incluye Agua'),{target:{value:'2'}});fireEvent.click(screen.getByText('Guardar combo'));await screen.findByText('Sin respuesta');fireEvent.click(screen.getByText('Reintentar mismo combo'));await screen.findByText(/Combo guardado/);expect(calls[0]).toEqual(calls[1]);
});
it('demo aplica combo al stock fisico y cobra precio especial',()=>{
 let s=seedProgram();const trip=s.trips.find(t=>t.stage==='planned')||s.trips[0],p=s.products.find(p=>p.active&&p.kind==='sale'),customer=trip.stops[0].clientId;
 if(trip.stage==='planned'){p.depot=Math.max(10,p.depot);s=loadTrip(s,trip.id,{[p.id]:5});}else{s.trips.find(t=>t.id===trip.id).stock[p.id]=5;}
 s.saleCombos=[{...combo,items:[{product_id:p.id,quantity:2}]}];const before=s.clients.find(c=>c.id===customer).held[p.id]||0;
 const next=recordVisit(s,{actorId:'owner',tripId:trip.id,clientId:customer,combos:{promo:1},items:[{productId:p.id,quantity:1,returned:0}],paid:'0',method:'Efectivo'});
 expect(next.sales[0].total).toBe(15000+p.price);expect(next.trips.find(t=>t.id===trip.id).stock[p.id]).toBe(2);if(p.returnable)expect(next.clients.find(c=>c.id===customer).held[p.id]).toBe(before+3);
});
