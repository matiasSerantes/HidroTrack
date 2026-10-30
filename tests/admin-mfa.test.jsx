// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {AdminMfaGate,AdminMfaPanel,mfaQrImage} from '../src/features/AdminMfa';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function fixture({enabled=true,allowed=false}={}){
 let permission=allowed;
 const factor={id:'factor-test',factor_type:'totp',status:'verified',friendly_name:'Prueba'};
 const client={rpc:vi.fn(async()=>({data:{enabled,allowed:permission},error:null})),auth:{onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}})),mfa:{listFactors:vi.fn(async()=>({data:{all:enabled?[factor]:[]},error:null})),challengeAndVerify:vi.fn(async()=>{permission=true;return {data:{},error:null};}),enroll:vi.fn(async()=>({data:{id:'new-factor',totp:{qr_code:'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'FICTITIOUS-TEST-KEY'}},error:null})),unenroll:vi.fn(async()=>({error:null}))},refreshSession:vi.fn(async()=>({error:null}))}};
 return client;
}
it('gate no monta datos privados hasta codigo correcto y permiso confirmado por servidor',async()=>{
 const client=fixture();render(<AdminMfaGate client={client}><p>Datos privados</p></AdminMfaGate>);
 const input=await screen.findByLabelText('Código del autenticador');expect(screen.queryByText('Datos privados')).toBeNull();
 client.auth.mfa.challengeAndVerify.mockResolvedValueOnce({error:{message:'invalid'}});
 fireEvent.change(input,{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Verificar código'}));await screen.findByRole('alert');expect(screen.queryByText('Datos privados')).toBeNull();
 fireEvent.change(screen.getByLabelText('Código del autenticador'),{target:{value:'654321'}});fireEvent.click(screen.getByRole('button',{name:'Verificar código'}));expect(await screen.findByText('Datos privados')).toBeTruthy();
});
it('fallo de estado no permite entrar ni asumir que MFA esta desactivado',async()=>{
 const client=fixture();client.rpc.mockResolvedValue({error:{message:'offline'},data:null});render(<AdminMfaGate client={client}><p>Datos privados</p></AdminMfaGate>);
 await screen.findByRole('alert');expect(screen.queryByText('Datos privados')).toBeNull();
});
it('respuesta del autenticador no abre el panel si el servidor aun rechaza la sesion',async()=>{
 const client=fixture();client.auth.mfa.challengeAndVerify.mockResolvedValue({data:{},error:null});render(<AdminMfaGate client={client}><p>Datos privados</p></AdminMfaGate>);
 fireEvent.change(await screen.findByLabelText('Código del autenticador'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Verificar código'}));
 await waitFor(()=>expect(client.rpc.mock.calls.length).toBeGreaterThan(1));expect(screen.queryByText('Datos privados')).toBeNull();
});
it('una respuesta perdida de alta exige actualizar y no permite crear otro factor a ciegas',async()=>{
 const client=fixture({enabled:false,allowed:true});client.auth.mfa.enroll.mockRejectedValue(new Error('timeout'));render(<AdminMfaPanel client={client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Activar doble factor'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Activar doble factor'}).disabled).toBe(true);
 client.auth.mfa.listFactors.mockResolvedValue({data:{all:[{id:'pending',factor_type:'totp',status:'unverified'}]},error:null});fireEvent.click(screen.getByRole('button',{name:'Actualizar estado de seguridad'}));
 expect(await screen.findByRole('button',{name:'Descartar alta incompleta'})).toBeTruthy();expect(client.auth.mfa.enroll).toHaveBeenCalledTimes(1);
});
it('desactivar autenticador exige codigo nuevo y confirmacion explicita',async()=>{
 const client=fixture({enabled:true,allowed:true});vi.spyOn(window,'confirm').mockReturnValue(true);render(<AdminMfaPanel client={client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Desactivar autenticador seleccionado'}));expect(client.auth.mfa.unenroll).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Código del autenticador'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Desactivar autenticador seleccionado'}));
 await waitFor(()=>expect(client.auth.mfa.unenroll).toHaveBeenCalledWith({factorId:'factor-test'}));expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'factor-test',code:'123456'});expect(client.auth.refreshSession).toHaveBeenCalled();
});
it('alta solo con click explicito, QR como imagen, clave en memoria y confirmacion real',async()=>{
 const client=fixture({enabled:false,allowed:true}),storage=vi.spyOn(Storage.prototype,'setItem');render(<AdminMfaPanel client={client}/>);
 const activate=await screen.findByRole('button',{name:'Activar doble factor'});expect(client.auth.mfa.enroll).not.toHaveBeenCalled();fireEvent.click(activate);
 expect(await screen.findByAltText('QR para tu aplicación autenticadora')).toBeTruthy();expect(screen.queryByText('FICTITIOUS-TEST-KEY')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Ingresar clave manualmente'}));expect(screen.getByText('FICTITIOUS-TEST-KEY')).toBeTruthy();expect(storage).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Código del autenticador'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar y activar'}));
 await waitFor(()=>expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'new-factor',code:'123456'}));await screen.findByText('Doble factor verificado. Tu sesión está protegida.');expect(screen.queryByText('FICTITIOUS-TEST-KEY')).toBeNull();
});
it('QR no se inyecta como HTML ni acepta un servidor externo',()=>{
 expect(mfaQrImage('<svg><path fill="#fff"/></svg>')).toContain('%23fff');expect(()=>mfaQrImage('https://example.test/qr')).toThrow();
});
it('acepta SVG con declaracion XML y comentario que genera Supabase',()=>{
 const svg='<?xml version="1.0"?>\n<!-- Generated by SVGo -->\n<svg xmlns="http://www.w3.org/2000/svg"><path fill="#fff"/></svg>';
 for(const raw of [svg,`data:image/svg+xml;utf-8,${svg}`,`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`]){
  const image=mfaQrImage(raw);expect(decodeURIComponent(image.split(',')[1])).toMatch(/^<svg/);expect(image).toContain('%23fff');
 }
});
it('si QR no se puede leer conserva alta y clave manual para confirmar sin duplicar factor',async()=>{
 const client=fixture({enabled:false,allowed:true});client.auth.mfa.enroll.mockResolvedValue({data:{id:'new-factor',totp:{qr_code:'unsupported',secret:'FICTITIOUS-TEST-KEY'}},error:null});
 render(<AdminMfaPanel client={client}/>);fireEvent.click(await screen.findByRole('button',{name:'Activar doble factor'}));
 expect(await screen.findByText('FICTITIOUS-TEST-KEY')).toBeTruthy();expect(screen.getByRole('button',{name:'Confirmar y activar'})).toBeTruthy();expect(client.auth.mfa.enroll).toHaveBeenCalledTimes(1);
});
it('cuando falla imagen en navegador muestra la alternativa manual sin perder el codigo',async()=>{
 const client=fixture({enabled:false,allowed:true});render(<AdminMfaPanel client={client}/>);fireEvent.click(await screen.findByRole('button',{name:'Activar doble factor'}));
 fireEvent.error(await screen.findByAltText('QR para tu aplicación autenticadora'));expect(screen.getByText('FICTITIOUS-TEST-KEY')).toBeTruthy();expect(screen.getByLabelText('Código del autenticador')).toBeTruthy();
});
