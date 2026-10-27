import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 const secret=Deno.env.get('VISIT_REMINDER_CRON_SECRET');
 if(req.method!=='POST'||!secret||req.headers.get('Authorization')!==`Bearer ${secret}`)return json(401,{error:'Unauthorized'});
 const publicKey=Deno.env.get('WEB_PUSH_PUBLIC_KEY'),privateKey=Deno.env.get('WEB_PUSH_PRIVATE_KEY');
 if(!publicKey||!privateKey)return json(503,{error:'Not configured'});
 const server=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const claimed=await server.rpc('push_claim_planning_notifications',{p_limit:20});
 if(claimed.error||!Array.isArray(claimed.data))return json(503,{error:'Queue unavailable'});
 webpush.setVapidDetails('https://hidrotrack.matilegen.workers.dev',publicKey,privateKey);
 let sent=0,cancelled=0,retried=0;
 for(let offset=0;offset<claimed.data.length;offset+=5){await Promise.all(claimed.data.slice(offset,offset+5).map(async job=>{
  const valid=await server.rpc('push_planning_job_still_valid',{p_id:job.id,p_claim:job.claim_token});let result='cancelled';
  if(!valid.error&&valid.data===true){try{
   await webpush.sendNotification({endpoint:job.endpoint,keys:job.keys},JSON.stringify({type:'next-day-planning',id:job.id,user_id:job.user_id,tenant_id:job.tenant_id,date:job.date,customer_count:job.customer_count,has_route:job.has_route,expires_at:job.expires_at}),{TTL:300,urgency:'high',timeout:5000});
   result='sent';sent++;
  }catch(e){const code=(e as {statusCode?:number}).statusCode;result=code===404||code===410?'gone':'retry';if(result==='retry')retried++;else cancelled++;}}
  else if(valid.error){result='retry';retried++;}else cancelled++;
  const finished=await server.rpc('push_finish_planning_job',{p_id:job.id,p_claim:job.claim_token,p_result:result});
  if(finished.error)retried++;
 }));}
 return json(200,{claimed:claimed.data.length,sent,cancelled,retried});
});
