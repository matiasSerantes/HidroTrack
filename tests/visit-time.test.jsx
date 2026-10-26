// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {dueVisitReminders} from '../src/domain/visitReminders';
import {CustomerVisitWindow} from '../src/features/CustomerVisitWindow';
import {VisitTimeReminders} from '../src/features/VisitTimeReminders';
import {PushNotificationConsent} from '../src/features/PushNotificationConsent';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const stop={id:'c',name:'Cliente ficticio',outcome:'pending',visit_start:'16:00',visit_end:'17:00',visit_starts_at:'2026-10-26T19:00:00Z',reminder_dismissed:false};
it('recordatorio empieza una hora antes y cambia de bloque cada media hora',()=>{
 expect(dueVisitReminders([stop],Date.parse('2026-10-26T17:59:59Z'),'2026-10-26')).toHaveLength(0);
 expect(dueVisitReminders([stop],Date.parse('2026-10-26T18:00:00Z'),'2026-10-26')[0].slot).toBe(0);
 expect(dueVisitReminders([stop],Date.parse('2026-10-26T18:30:00Z'),'2026-10-26')[0].slot).toBe(1);
 for(const outcome of ['delivered','no_purchase','absent'])expect(dueVisitReminders([{...stop,outcome}],Date.parse('2026-10-26T18:30:00Z'),'2026-10-26')).toHaveLength(0);
 expect(dueVisitReminders([{...stop,reminder_dismissed:true}],Date.parse('2026-10-26T18:30:00Z'),'2026-10-26')).toHaveLength(0);
});
it('guarda franja del cliente y rechaza final anterior al inicio',async()=>{
 const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:null,error:null})},client={from:()=>chain,rpc:vi.fn(async()=>({data:{saved:true},error:null}))};
 render(<CustomerVisitWindow client={client} tenantId="t" customerId="c" disabled={false} onLock={()=>{}}/>);const start=await screen.findByLabelText('Te espera desde');fireEvent.change(start,{target:{value:'16:00'}});fireEvent.change(screen.getByLabelText('Te espera hasta'),{target:{value:'15:00'}});fireEvent.click(screen.getByRole('button',{name:'Guardar horario de visita'}));await screen.findByRole('alert');expect(client.rpc).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Te espera hasta'),{target:{value:'17:00'}});fireEvent.click(screen.getByRole('button',{name:'Guardar horario de visita'}));await screen.findByText('Horario guardado: 16:00 a 17:00.');expect(client.rpc).toHaveBeenCalledWith('customer_set_visit_window',{p_tenant:'t',p_customer:'c',p_start:'16:00',p_end:'17:00'});
});
it('no llegue detiene avisos sin afirmar entrega',async()=>{
 const client={rpc:vi.fn(async()=>({data:{dismissed:true},error:null}))},changed=vi.fn();render(<VisitTimeReminders client={client} tenantId="t" tripId="r" date="2026-10-26" serverNow="2026-10-26T18:00:00Z" stops={[stop]} disabled={false} onSelect={()=>{}} onLock={()=>{}} onChanged={changed}/>);fireEvent.click(screen.getByRole('button',{name:'No llegué a horario · Cliente ficticio'}));await waitFor(()=>expect(changed).toHaveBeenCalledTimes(1));expect(client.rpc).toHaveBeenCalledExactlyOnceWith('route_dismiss_time_reminder',{p_tenant:'t',p_trip:'r',p_customer:'c'});
});
it('PC no solicita permiso ni consulta suscripcion movil',()=>{
 const client={rpc:vi.fn()},permission=vi.fn();vi.stubGlobal('Notification',{requestPermission:permission});render(<PushNotificationConsent client={client}/>);expect(screen.queryByRole('button',{name:'Activar recordatorios en este celular'})).toBeNull();expect(permission).not.toHaveBeenCalled();expect(client.rpc).not.toHaveBeenCalled();
});
it('celular pide permiso solo al tocar y respeta rechazo',async()=>{
 const permission=vi.fn(async()=> 'denied');vi.stubGlobal('Notification',{requestPermission:permission});vi.stubGlobal('PushManager',function(){});vi.stubGlobal('navigator',{userAgent:'Android Mobile',platform:'Linux',maxTouchPoints:1,serviceWorker:{getRegistration:vi.fn(async()=>undefined)}});
 const client={rpc:vi.fn(async()=>({data:{enabled:true,public_key:'A'.repeat(87)},error:null}))};render(<PushNotificationConsent client={client}/>);const button=await screen.findByRole('button',{name:'Activar recordatorios en este celular'});expect(permission).not.toHaveBeenCalled();fireEvent.click(button);await screen.findByText(/No activamos avisos/);expect(permission).toHaveBeenCalledTimes(1);expect(client.rpc.mock.calls.every(([name])=>name==='push_get_settings')).toBe(true);
});
