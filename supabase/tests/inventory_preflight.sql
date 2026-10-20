-- Read-only component inventory. Presence does not replace migration history.
-- Execute through authenticated MCP in the verified project before migrating.
with components(version, name, present) as (values
 ('20261019180000', 'inventory_record_stock', to_regprocedure('public.inventory_record_stock(uuid,uuid,text,uuid,uuid,jsonb,text,date)') is not null),
 ('20261019180000', 'inventory_remove', to_regprocedure('public.inventory_remove(uuid,uuid,text,uuid,integer,text,uuid,uuid,date,text,uuid,text)') is not null),
 ('20261019180000', 'inventory_retire_dispenser', to_regprocedure('public.inventory_retire_dispenser(uuid,uuid,uuid,date,text,uuid,text)') is not null),
 ('20261019180000', 'products.family', exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='family')),
 ('20261019180000', 'inventory_operations.occurred_on', exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory_operations' and column_name='occurred_on')),
 ('20261019180000', 'dispensers.retired', exists(select 1 from information_schema.columns where table_schema='public' and table_name='dispensers' and column_name='retired')),
 ('20261019190000', 'dispenser_assignments', to_regclass('public.dispenser_assignments') is not null),
 ('20261019190000', 'inventory_assign_dispenser_model', to_regprocedure('public.inventory_assign_dispenser_model(uuid,uuid,uuid,uuid,text,numeric,date,uuid)') is not null),
 ('20261019190000', 'inventory_return_dispenser_model', to_regprocedure('public.inventory_return_dispenser_model(uuid,uuid,uuid,date)') is not null),
 ('20261019200000', 'inventory_product_archive_guard', exists(select 1 from pg_trigger where tgname='inventory_product_archive_guard' and tgrelid=to_regclass('public.products') and tgenabled <> 'D' and not tgisinternal))
)
select version,
 case when bool_and(present) then 'present' when bool_or(present) then 'partial' else 'absent' end as component_status,
 array_agg(name order by name) filter(where not present) as missing_components
from components group by version order by version;
