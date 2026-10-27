import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {it,expect,vi} from 'vitest';
async function setup({valid=true,sendError=null}={}){
 const job={id:'job',claim_token:'claim',user_id:'user',tenant_id:'tenant',date:'2026-10-28',customer_count:3,has_route:false,expires_at:'2026-10-28T00:00:00Z',endpoint:'https://fcm.googleapis.com/fake',keys:{p256dh:'fictional',auth:'fictional'}};
 const rpc=vi.fn(async(name)=>({data:name==='push_claim_planning_notifications'?[job]:name==='push_planning_job_still_valid'?valid:null,error:null}));
 const sendNotification=vi.fn(async()=>{if(sendError)throw sendError;}),env={VISIT_REMINDER_CRON_SECRET:'fake-cron',WEB_PUSH_PUBLIC_KEY:'fake-public',WEB_PUSH_PRIVATE_KEY:'fake-private'};let handler;
 const source=(await readFile(new URL('../supabase/functions/planning-reminders/index.ts',import.meta.url),'utf8')).replace(/^import .*\r?\n/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 vm.runInNewContext(js,{Deno:{env:{get:key=>env[key]??'https://example.test'},serve:fn=>{handler=fn;}},createClient:()=>({rpc}),webpush:{setVapidDetails:vi.fn(),sendNotification},Response,Promise});
 return {rpc,sendNotification,handler,job};
}
it('emisor diario rechaza llamadas sin secreto antes de consultar cola',async()=>{
 const v=await setup();const r=await v.handler(new Request('https://example.test',{method:'POST'}));expect(r.status).toBe(401);expect(v.rpc).not.toHaveBeenCalled();
});
it('emisor diario revalida y envia solo resumen y destino autorizado',async()=>{
 const v=await setup();const r=await v.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer fake-cron'}}));expect((await r.json()).sent).toBe(1);expect(v.sendNotification).toHaveBeenCalledTimes(1);expect(JSON.parse(v.sendNotification.mock.calls[0][1])).toMatchObject({type:'next-day-planning',tenant_id:'tenant',date:'2026-10-28',customer_count:3});expect(v.rpc).toHaveBeenLastCalledWith('push_finish_planning_job',{p_id:'job',p_claim:'claim',p_result:'sent'});
});
it('permiso retirado impide envio; endpoint caducado se finaliza como gone',async()=>{
 const revoked=await setup({valid:false});await revoked.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer fake-cron'}}));expect(revoked.sendNotification).not.toHaveBeenCalled();
 const gone=await setup({sendError:{statusCode:410}});await gone.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer fake-cron'}}));expect(gone.rpc).toHaveBeenLastCalledWith('push_finish_planning_job',{p_id:'job',p_claim:'claim',p_result:'gone'});
});
