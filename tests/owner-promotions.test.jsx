// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerPromotions } from '../src/features/OwnerPromotions';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function fixture({failOnce=false}={}){
  const records={products:[{id:'water',name:'Bidón',returnable:true,family:'article',active:true}],promotions:[],inventory_owned_stock:[{product_id:'water',depot_ready:10}],inventory_operations:[],tenant_members:[{user_id:'driver',role:'driver',promotion_allowed:false}],user_profiles:[{user_id:'driver',full_name:'Asistente de prueba'}],promotion_events:[],promotion_notifications:[]};
  const filters=[];
  const client={from:vi.fn(table=>{const chain={select:()=>chain,eq:(key,value)=>{filters.push([table,key,value]);return chain;},not:()=>chain,order:()=>chain,range:()=>chain,then:resolve=>Promise.resolve({data:structuredClone(records[table]||[]),error:null}).then(resolve)};return chain;}),rpc:vi.fn(async(name,args)=>{
    if(failOnce){failOnce=false;return {error:{message:'Sin confirmación de red'}};}
    if(name==='promotion_offer'){
      records.promotions.push({id:args.p_id,author_id:'owner',name:args.p_name,address:args.p_address,phone:args.p_phone,terms:args.p_terms,started_on:args.p_date,follow_up:args.p_follow_up,status:'trial',delivered:args.p_items});
      records.inventory_operations.push({promotion_id:args.p_id,inventory_movements:args.p_items.map(i=>({product_id:i.product_id,promotion_held:i.quantity,promotion_damaged:0}))});
    }
    if(name==='promotion_set_permission')records.tenant_members[0].promotion_allowed=args.p_allowed;
    if(name==='promotion_read_notification')records.promotion_notifications.find(n=>n.id===args.p_id).read_at='now';
    return {data:'ok',error:null};
  })};
  const converted=vi.fn();const view=render(<OwnerPromotions client={client} tenantId="tenant" userId="owner" onConverted={converted}/>);
  return {client,records,filters,converted,view};
}
async function fill(){await screen.findByText('Ofrecer promoción');fireEvent.click(screen.getByText('Ofrecer promoción'));fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Persona de prueba'}});fireEvent.change(screen.getByLabelText('Dirección'),{target:{value:'Calle demo'}});fireEvent.change(screen.getByLabelText('Condiciones y precio pactados'),{target:{value:'Prueba acordada'}});fireEvent.change(screen.getByLabelText('Entregar Bidón'),{target:{value:'2'}});}
it('registra la promoción por RPC con fecha y cantidad; aísla consultas por empresa',async()=>{
  const {client,filters}=fixture();await fill();fireEvent.click(screen.getByText('Registrar promoción'));
  await screen.findByText('Persona de prueba');expect(client.rpc).toHaveBeenCalledWith('promotion_offer',expect.objectContaining({p_tenant:'tenant',p_trip:null,p_items:[{product_id:'water',quantity:2}],p_name:'Persona de prueba'}));
  for(const table of ['products','promotions','inventory_owned_stock','inventory_operations','tenant_members','promotion_events','promotion_notifications'])expect(filters).toContainEqual([table,'tenant_id','tenant']);
});
it('ante respuesta incierta reintenta exactamente los mismos IDs y datos',async()=>{
  const {client}=fixture({failOnce:true});await fill();fireEvent.click(screen.getByText('Registrar promoción'));
  fireEvent.click(await screen.findByText('Reintentar operación'));
  await screen.findByText('Persona de prueba');expect(client.rpc).toHaveBeenCalledTimes(2);expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
});
it('permiso individual y aviso leído usan la RPC y el identificador del aviso',async()=>{
  const {client,records}=fixture();await screen.findByText('Ofrecer promoción');
  records.promotion_notifications.push({id:'notification',promotion_id:'historical',read_at:null});
  fireEvent.click(screen.getByLabelText('Permitir ofrecer promociones a Asistente de prueba'));
  await screen.findByText('Permiso del asistente actualizado.');
  expect(client.rpc).toHaveBeenCalledWith('promotion_set_permission',expect.objectContaining({p_user:'driver',p_allowed:true}));
  fireEvent.click(screen.getByText('Marcar leído'));await screen.findByText('Aviso marcado como leído.');
  expect(client.rpc).toHaveBeenCalledWith('promotion_read_notification',{p_tenant:'tenant',p_id:'notification'});
});
it('convierte usando una sola RPC sin ingresar stock adicional y refresca clientes',async()=>{
  const {client,converted}=fixture();await fill();fireEvent.click(screen.getByText('Registrar promoción'));await screen.findByText('Persona de prueba');
  fireEvent.click(screen.getByText('Acepta · pasar a cliente'));
  await waitFor(()=>expect(converted).toHaveBeenCalledTimes(1));
  expect(client.rpc.mock.calls.map(([name])=>name)).toEqual(['promotion_offer','promotion_resolve']);
  expect(client.rpc.mock.calls[1][1]).toMatchObject({p_action:'convert',p_tenant:'tenant',p_monthly:{}});
});
it('rechaza y registra devoluciones con cantidades y fecha por la RPC correspondiente',async()=>{
  const {client,records}=fixture();await fill();fireEvent.click(screen.getByText('Registrar promoción'));await screen.findByText('Persona de prueba');
  fireEvent.click(screen.getByText('No continúa · recuperar bienes'));
  await screen.findByText('Promoción pendiente de recuperar bienes.');
  expect(client.rpc).toHaveBeenLastCalledWith('promotion_resolve',expect.objectContaining({p_action:'reject'}));
  records.promotions[0].status='recovery';fireEvent.click(screen.getByText('Actualizar promociones'));
  await screen.findByText('Registrar devolución');
  fireEvent.change(screen.getByLabelText('Devuelve en buen estado'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Devuelve dañado'),{target:{value:'1'}});
  fireEvent.click(screen.getByText('Registrar devolución'));
  await waitFor(()=>expect(client.rpc).toHaveBeenLastCalledWith('promotion_recover',expect.objectContaining({p_items:[{product_id:'water',good:1,damaged:1}]})));
});
