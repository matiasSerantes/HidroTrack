// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {PlanningReminderPreferences} from '../src/features/PlanningReminderPreferences';
import {readPlanningLink} from '../src/domain/visitPlanning';
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();});
it('PC no pide permisos ni cambia preferencia del celular',()=>{
 const client={rpc:vi.fn()};render(<PlanningReminderPreferences client={client} tenantId="t"/>);expect(client.rpc).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Activar aviso de las 20'})).toBeNull();
});
it('permiso existente de horarios no activa aviso diario hasta tocar su boton',async()=>{
 const endpoint='https://fcm.googleapis.com/fake';localStorage.setItem('hidrotrack:push-active',endpoint);
 const permission=vi.fn(),registration={update:async()=>{},pushManager:{getSubscription:async()=>({endpoint})}};
 vi.stubGlobal('navigator',{userAgent:'Android Mobile',platform:'Linux',maxTouchPoints:1,serviceWorker:{getRegistration:async()=>registration}});vi.stubGlobal('Notification',{requestPermission:permission});vi.stubGlobal('PushManager',function(){});
 const client={rpc:vi.fn(async(name,args)=>name==='push_get_settings'?{data:{enabled:true,public_key:'A'.repeat(87)},error:null}:name==='owner_planning_reminder_settings'?{data:{available:true,enabled:false},error:null}:{data:{enabled:args.p_enabled},error:null})};
 render(<PlanningReminderPreferences client={client} tenantId="t"/>);const button=await screen.findByRole('button',{name:'Activar aviso de las 20'});await waitFor(()=>expect(button.disabled).toBe(false));expect(client.rpc.mock.calls.some(([name])=>name==='owner_set_planning_reminder')).toBe(false);expect(permission).not.toHaveBeenCalled();fireEvent.click(button);await screen.findByText('Aviso de las 20:00 activado para esta empresa.');expect(client.rpc).toHaveBeenCalledWith('owner_set_planning_reminder',{p_tenant:'t',p_enabled:true});
});
it('enlace de notificacion valida fecha y empresa antes de sugerir contexto',()=>{
 expect(readPlanningLink('?planificar=2026-10-28&empresa=10000000-0000-0000-0000-000000000001')).toEqual({date:'2026-10-28',tenant:'10000000-0000-0000-0000-000000000001'});expect(readPlanningLink('?planificar=2026-02-31&empresa=other')).toEqual({date:undefined,tenant:undefined});
});
