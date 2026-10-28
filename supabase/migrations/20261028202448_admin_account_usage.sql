begin;
create index inventory_trips_created_usage on public.inventory_trips(tenant_id,created_at);
create index inventory_trips_service_usage on public.inventory_trips(tenant_id,service_date);
create function public.admin_account_usage(p_date date default (now() at time zone 'America/Argentina/Buenos_Aires')::date,p_offset integer default 0,p_search text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;day_start timestamptz;day_end timestamptz;q text:=trim(coalesce(p_search,''));
begin
 if not private.is_admin() then raise exception 'Solo superadministracion' using errcode='42501'; end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>date '2100-12-31' or p_offset is null or p_offset<0 or p_offset>100000 or length(q)>120 then raise exception 'Fecha, busqueda o pagina invalida'; end if;
 day_start:=p_date::timestamp at time zone 'America/Argentina/Buenos_Aires';
 day_end:=(p_date+1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
 with matches as materialized (
  select t.id,t.name from public.tenants t where q='' or position(lower(q) in lower(t.name))>0
   or exists(select 1 from public.tenant_members m join auth.users u on u.id=m.user_id left join public.user_profiles p on p.user_id=m.user_id
    where m.tenant_id=t.id and m.role='owner' and position(lower(q) in lower(coalesce(u.email,'')||' '||coalesce(p.full_name,'')))>0)
 ),page as materialized (select * from matches order by name,id limit 50 offset p_offset),
 stock as (
  select m.tenant_id,coalesce(sum(m.depot_ready+m.depot_empty+m.truck_ready+m.truck_empty+m.customer_held+m.promotion_held+m.promotion_damaged),0) total,
   coalesce(sum(m.depot_ready),0) depot_ready,coalesce(sum(m.depot_empty),0) depot_empty,
   coalesce(sum(m.truck_ready+m.truck_empty),0) truck,coalesce(sum(m.customer_held),0) customers,
   coalesce(sum(m.promotion_held),0) promotions,coalesce(sum(m.promotion_damaged),0) damaged
  from public.inventory_movements m join page p on p.id=m.tenant_id group by m.tenant_id
 ),models as (
  select p.tenant_id,count(*) filter(where p.active) active_products from public.products p join page a on a.id=p.tenant_id group by p.tenant_id
 ),equipment as (
  select d.tenant_id,count(*) total,count(*) filter(where d.location='depot') depot,count(*) filter(where d.location='truck') truck,count(*) filter(where d.location='customer') customers
  from public.dispensers d join page a on a.id=d.tenant_id where d.ownership='company' and not d.retired group by d.tenant_id
 ),trips as (
  select t.tenant_id,count(*) filter(where t.created_at>=day_start and t.created_at<day_end) created,
   count(*) filter(where t.created_at>=day_start and t.created_at<day_end and t.removed_at is not null) created_removed,
   count(*) filter(where t.service_date=p_date and t.removed_at is null) scheduled,
   count(*) filter(where t.service_date=p_date and t.removed_at is null and t.status='planned') planned,
   count(*) filter(where t.service_date=p_date and t.removed_at is null and t.status in ('active','submitted')) running,
   count(*) filter(where t.service_date=p_date and t.removed_at is null and t.status='closed') closed
  from public.inventory_trips t join page a on a.id=t.tenant_id
  where (t.created_at>=day_start and t.created_at<day_end) or t.service_date=p_date group by t.tenant_id
 )
 select jsonb_build_object('date',p_date,'generated_at',now(),'count',(select count(*) from matches),'items',coalesce((select jsonb_agg(jsonb_build_object(
  'tenant_id',a.id,'company',a.name,
  'owner',coalesce((select string_agg(u.email::text,', ' order by u.email) from public.tenant_members m join auth.users u on u.id=m.user_id where m.tenant_id=a.id and m.role='owner'),'Sin titular'),
  'active_products',coalesce(m.active_products,0),'stock_total',coalesce(s.total,0),'depot_ready',coalesce(s.depot_ready,0),'depot_empty',coalesce(s.depot_empty,0),
  'truck',coalesce(s.truck,0),'customers',coalesce(s.customers,0),'promotions',coalesce(s.promotions,0),'damaged',coalesce(s.damaged,0),
  'equipment_total',coalesce(e.total,0),'equipment_depot',coalesce(e.depot,0),'equipment_truck',coalesce(e.truck,0),'equipment_customers',coalesce(e.customers,0),
  'trips_created',coalesce(t.created,0),'trips_created_removed',coalesce(t.created_removed,0),'trips_scheduled',coalesce(t.scheduled,0),'trips_planned',coalesce(t.planned,0),'trips_running',coalesce(t.running,0),'trips_closed',coalesce(t.closed,0)
 ) order by a.name,a.id) from page a left join stock s on s.tenant_id=a.id left join models m on m.tenant_id=a.id left join equipment e on e.tenant_id=a.id left join trips t on t.tenant_id=a.id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.admin_account_usage(date,integer,text) from public,anon,authenticated;
grant execute on function public.admin_account_usage(date,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
