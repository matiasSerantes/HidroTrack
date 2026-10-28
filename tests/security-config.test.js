import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
import {assertPublicSupabaseConfig} from '../tools/public-config.mjs';
const url='https://project.supabase.co';
const jwt=role=>`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
it('build admite clave publishable o anon y modo sin configuracion',()=>{
 expect(()=>assertPublicSupabaseConfig({})).not.toThrow();
 for(const key of ['sb_publishable_example',jwt('anon')])expect(()=>assertPublicSupabaseConfig({VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:key})).not.toThrow();
});
it('build rechaza claves administrativas sin revelarlas en el error',()=>{
 for(const key of ['sb_secret_never_print_me',jwt('service_role'),'malformed']){
  let error;try{assertPublicSupabaseConfig({VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:key});}catch(e){error=e;}
  expect(error).toBeTruthy();expect(error.message).not.toContain(key);
 }
 expect(()=>assertPublicSupabaseConfig({VITE_SUPABASE_URL:url})).toThrow();
 expect(()=>assertPublicSupabaseConfig({VITE_SUPABASE_URL:'http://project.supabase.co',VITE_SUPABASE_ANON_KEY:jwt('anon')})).toThrow();
});
it('CSP permite mapa/GPS/push pero bloquea scripts externos, eval, marcos y bases inyectadas',async()=>{
 const headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
 const csp=headers.match(/Content-Security-Policy: (.+)/)[1];
 expect(csp).toContain("script-src 'self';");expect(csp).not.toContain("'unsafe-eval'");expect(csp.match(/script-src[^;]+/)[0]).not.toContain("'unsafe-inline'");
 for(const directive of ["frame-ancestors 'none'","base-uri 'none'","object-src 'none'","worker-src 'self'","form-action 'self'"])expect(csp).toContain(directive);
 for(const host of ['https://photon.komoot.io','https://router.project-osrm.org','https://tuqdutglubkmuxumjqyv.supabase.co','wss://tuqdutglubkmuxumjqyv.supabase.co'])expect(csp).toContain(host);
 expect(headers).toContain('geolocation=(self)');expect(headers).toContain('Referrer-Policy: strict-origin');expect(headers).toContain('X-Content-Type-Options: nosniff');
 const plan=await readFile(new URL('../public/plan.html',import.meta.url),'utf8');expect(plan).not.toMatch(/<script>/);expect(plan).toContain('src="/plan.js"');
});
