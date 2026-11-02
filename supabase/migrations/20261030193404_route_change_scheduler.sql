begin;
create function private.dispatch_route_changes() returns bigint language plpgsql security definer set search_path='' as $$
declare secret text;request_id bigint;
begin
 delete from private.route_change_events where id in(select id from private.route_change_events where created_at<now()-interval '7 days' order by created_at limit 500);
 if not exists(select 1 from private.route_change_config where enabled) then return null;end if;
 if not exists(select 1 from private.route_change_events e join private.web_push_subscriptions s on s.user_id=e.recipient_id and s.active where e.created_at>now()-interval '24 hours' and private.route_change_push_eligible(e.id,now()) and not exists(select 1 from private.route_change_jobs j where j.event_id=e.id and j.subscription_id=s.id and (j.state<>'pending' or j.attempts>=3))) then return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='hidrotrack_visit_push_cron' limit 1;
 if secret is null then return null;end if;
 select net.http_post(url:='https://tuqdutglubkmuxumjqyv.supabase.co/functions/v1/route-changes',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=30000) into request_id;
 return request_id;
end $$;
revoke all on function private.dispatch_route_changes() from public,anon,authenticated;
do $$ begin
 if to_regnamespace('cron') is not null then perform cron.schedule('hidrotrack-route-changes','* * * * *','select private.dispatch_route_changes();');end if;
end $$;
commit;
