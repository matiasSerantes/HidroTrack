// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {AccountAccess} from '../src/features/AccountAccess';
import {googleAccessRedirect} from '../src/domain/googleAccess';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();window.history.replaceState(null,'','/');});
function provider(enabled){vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','sb_publishable_test');vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({external:{google:enabled}})})));return {auth:{signInWithOAuth:vi.fn(async()=>({data:{url:'https://project.supabase.co/auth/v1/authorize'},error:null}))}};}
it('Google deshabilitado se muestra pendiente y no redirige a un error de Supabase',async()=>{
 const client=provider(false);render(<AccountAccess client={client} onSession={()=>{}}/>);
 await screen.findByText(/cuando se termine de configurar/);expect(screen.getByRole('button',{name:'Continuar con Google'}).disabled).toBe(true);expect(client.auth.signInWithOAuth).not.toHaveBeenCalled();
});
it('Google crea o ingresa con regreso al sitio y conserva intencion de jefe sin requerir password',async()=>{
 const client=provider(true);window.history.replaceState(null,'','/?registro=jefe');render(<AccountAccess client={client} onSession={()=>{}}/>);
 const button=screen.getByRole('button',{name:'Continuar con Google'});await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);
 await waitFor(()=>expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({provider:'google',options:{redirectTo:expect.stringContaining('registro=jefe'),queryParams:{prompt:'select_account'}}}));
 const callback=new URL(client.auth.signInWithOAuth.mock.calls[0][0].options.redirectTo);expect(callback.origin).toBe(window.location.origin);expect(callback.searchParams.get('acceso')).toBe('google');
});
it('callback no transporta tokens ni destinos externos suministrados por query',()=>{
 const url=new URL(googleAccessRedirect('https://hidrotrack.example/?next=https://evil.test&access_token=secret&admin=seguridad#token',false));
 expect(url.origin).toBe('https://hidrotrack.example');expect(url.searchParams.get('admin')).toBe('seguridad');expect(url.searchParams.has('next')).toBe(false);expect(url.searchParams.has('access_token')).toBe(false);expect(url.hash).toBe('');
});
