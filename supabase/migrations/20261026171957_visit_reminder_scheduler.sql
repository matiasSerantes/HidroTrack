begin;
-- The local WASM test database has no networking/cron extensions. Production
-- Supabase supports both; keep the core queue independently testable locally.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') and exists(select 1 from pg_available_extensions where name='pg_net') then
  execute 'create extension if not exists pg_cron';
  execute 'create extension if not exists pg_net';
 end if;
end $$;
create function private.dispatch_visit_reminders() returns bigint language plpgsql security definer set search_path='' as $$
declare secret text;request_id bigint;
begin
 if not exists(select 1 from private.web_push_config where id and enabled and public_key<>'') then return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='hidrotrack_visit_push_cron' limit 1;
 if secret is null then return null;end if;
 select net.http_post(url:='https://tuqdutglubkmuxumjqyv.supabase.co/functions/v1/visit-reminders',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=30000) into request_id;
 return request_id;
end $$;
revoke all on function private.dispatch_visit_reminders() from public,anon,authenticated;
do $$ begin
 if to_regnamespace('cron') is not null then
  perform cron.schedule('hidrotrack-visit-reminders','* * * * *','select private.dispatch_visit_reminders();');
 end if;
end $$;
commit;
