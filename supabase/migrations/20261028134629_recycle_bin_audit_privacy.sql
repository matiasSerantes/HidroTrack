begin;
-- A record may have been deleted/restored more than once. Expiring its latest
-- deletion must also clear identifying labels from earlier recovery audits.
create function private.scrub_recycle_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.state='purged' and old.state='deleted' then
  update private.recycle_bin set label='Eliminado',payload=null
   where tenant_id=new.tenant_id and kind=new.kind and entity_id=new.entity_id and id<>new.id;
 end if;
 return new;
end $$;
create trigger scrub_recycle_history after update of state on private.recycle_bin for each row execute function private.scrub_recycle_history();
revoke all on function private.scrub_recycle_history() from public,anon,authenticated;
commit;
