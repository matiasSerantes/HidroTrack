begin;
create function public.admin_search_recycle_bin(p_offset integer default 0,p_tenant uuid default null,p_kind text default 'all',p_search text default '',p_from date default null,p_to date default null,p_recovery text default 'all') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or p_kind is null or p_kind not in ('all','customer','trip') or p_recovery is null or p_recovery not in ('all','available','expired') or length(coalesce(p_search,''))>200 or (p_from is not null and not isfinite(p_from)) or (p_to is not null and not isfinite(p_to)) or p_from>p_to then raise exception 'Filtros invalidos'; end if;
 with source as (
 select r.id,r.kind,r.label,r.tenant_id,t.name company,r.deleted_at,r.expires_at,
 coalesce(p.full_name,'Usuario de la empresa') deleted_by,
 r.expires_at>now() and r.payload is not null recoverable,
 r.payload->'row'->>'address' address,r.payload->'row'->>'service_date' service_date,
 translate(lower(concat_ws(' ',r.label,t.name,p.full_name,r.payload->'row'->>'address',r.payload->'row'->>'phone',r.payload->'row'->>'phone2',r.payload->'row'->>'phone3',r.payload->'row'->>'phone4',r.payload->'row'->>'phone5',r.payload->'row'->>'phone6',r.payload->'row'->>'delivery_notes',r.payload->'row'->>'service_date')),'áàäâéèëêíìïîóòöôúùüûñ','aaaaeeeeiiiioooouuuun') search_text
 from private.recycle_bin r join public.tenants t on t.id=r.tenant_id left join public.user_profiles p on p.user_id=r.deleted_by where r.state='deleted'
 ), filtered as (
 select * from source s where (p_tenant is null or s.tenant_id=p_tenant) and (p_kind='all' or s.kind=p_kind)
 and (p_from is null or s.deleted_at>=p_from::timestamp at time zone 'America/Argentina/Buenos_Aires')
 and (p_to is null or s.deleted_at<(p_to+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
 and (p_recovery='all' or s.recoverable=(p_recovery='available'))
 and not exists(select 1 from regexp_split_to_table(translate(lower(trim(coalesce(p_search,''))),'áàäâéèëêíìïîóòöôúùüûñ','aaaaeeeeiiiioooouuuun'),'\s+') token where token<>'' and position(token in s.search_text)=0)
 ), page as (select * from filtered order by deleted_at desc,id limit 50 offset p_offset)
 select jsonb_build_object('count',(select count(*) from filtered),'total',(select count(*) from source),
 'companies',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from (select distinct tenant_id id,company name from source) c),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(page)-'search_text' order by deleted_at desc,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.admin_search_recycle_bin(integer,uuid,text,text,date,date,text) from public,anon,authenticated;
grant execute on function public.admin_search_recycle_bin(integer,uuid,text,text,date,date,text) to authenticated;
commit;
