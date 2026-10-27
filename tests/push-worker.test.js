import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {it,expect,vi} from 'vitest';
async function worker(){
 const listeners={},store=new Map(),showNotification=vi.fn(async()=>{}),close=vi.fn();
 const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={createObjectStore(){},close(){},transaction(){const tx={objectStore(){return {put(value,key){const op={};queueMicrotask(()=>{store.set(key,value);op.result=key;op.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return op;},get(key){const op={};queueMicrotask(()=>{op.result=store.get(key);op.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return op;}};}};return tx;}};request.onsuccess?.();});return request;}};
 const openWindow=vi.fn();const self={addEventListener:(event,fn)=>{listeners[event]=fn;},registration:{showNotification,getNotifications:async()=>[{data:{tripId:'r',customerId:'c'},close}]},clients:{claim:vi.fn(),matchAll:async()=>[],openWindow},location:{origin:'https://example.test'}};
 vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,indexedDB,Date,URL,JSON,Promise,String,Number});
 async function message(data){let promise;listeners.message({data,waitUntil:p=>{promise=p;}});await promise;}
 async function push(overrides={}){let promise;listeners.push({data:{json:()=>({type:'visit-time',id:'j',user_id:'u',trip_id:'r',customer_id:'c',customer:'Ficticio',start:'16:00',end:'17:00',expires_at:new Date(Date.now()+60000).toISOString(),...overrides})},waitUntil:p=>{promise=p;}});await promise;}
 async function click(data){let promise;listeners.notificationclick({notification:{data,close:vi.fn()},waitUntil:p=>{promise=p;}});await promise;}
 return {message,push,showNotification,close,click,openWindow};
}
it('muestra aviso solo para cuenta actual y no despues de cerrar sesion',async()=>{const w=await worker();await w.message({type:'PUSH_SESSION',userId:'u'});await w.push();expect(w.showNotification).toHaveBeenCalledTimes(1);await w.push({user_id:'otro'});expect(w.showNotification).toHaveBeenCalledTimes(1);await w.message({type:'PUSH_SESSION',userId:null});await w.push();expect(w.showNotification).toHaveBeenCalledTimes(1);});
it('ignora mensajes vencidos y paradas ya resueltas, cierra notificacion anterior',async()=>{const w=await worker();await w.message({type:'PUSH_SESSION',userId:'u'});await w.push({expires_at:new Date(Date.now()-1000).toISOString()});expect(w.showNotification).not.toHaveBeenCalled();await w.message({type:'VISITS_RESOLVED',tripId:'r',customers:['c']});expect(w.close).toHaveBeenCalledTimes(1);await w.push();expect(w.showNotification).not.toHaveBeenCalled();});
it('planificacion se muestra una vez por cuenta empresa y dia, independiente de paradas resueltas',async()=>{
 const w=await worker(),payload={type:'next-day-planning',tenant_id:'10000000-0000-0000-0000-000000000001',date:'2026-10-28',customer_count:3,has_route:false};await w.message({type:'PUSH_SESSION',userId:'u'});await w.message({type:'VISITS_RESOLVED',tripId:'r',customers:['c']});await w.push(payload);await w.push(payload);expect(w.showNotification).toHaveBeenCalledTimes(1);await w.push({...payload,user_id:'other'});expect(w.showNotification).toHaveBeenCalledTimes(1);
});
it('planificacion invalida no abre enlaces arbitrarios y click usa fecha y empresa',async()=>{
 const w=await worker(),tenant='10000000-0000-0000-0000-000000000001';await w.message({type:'PUSH_SESSION',userId:'u'});await w.push({type:'next-day-planning',tenant_id:tenant,date:'2026-02-31',customer_count:3});expect(w.showNotification).not.toHaveBeenCalled();await w.click({type:'next-day-planning',tenantId:tenant,date:'2026-10-28',url:'https://malicious.test'});const url=new URL(w.openWindow.mock.calls[0][0]);expect(url.origin).toBe('https://example.test');expect(url.searchParams.get('planificar')).toBe('2026-10-28');expect(url.searchParams.get('empresa')).toBe(tenant);
});
