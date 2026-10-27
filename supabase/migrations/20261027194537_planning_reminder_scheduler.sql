begin;
create function private.dispatch_planning_reminders() returns bigint language plpgsql security definer set search_path='' as $$
declare secret text;request_id bigint;local_time time:=(now() at time zone 'America/Argentina/Buenos_Aires')::time;
begin
 if local_time<time '20:00' or local_time>=time '21:00' or not exists(select 1 from private.planning_push_config where enabled) then return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='hidrotrack_visit_push_cron' limit 1;
 if secret is null then return null;end if;
 select net.http_post(url:='https://tuqdutglubkmuxumjqyv.supabase.co/functions/v1/planning-reminders',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=30000) into request_id;
 return request_id;
end $$;
revoke all on function private.dispatch_planning_reminders() from public,anon,authenticated;
do $$ begin
 if to_regnamespace('cron') is not null then
  perform cron.schedule('hidrotrack-planning-reminders','* * * * *','select private.dispatch_planning_reminders();');
 end if;
end $$;
commit;
