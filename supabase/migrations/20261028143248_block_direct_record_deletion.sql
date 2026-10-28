begin;
-- The supported deletion paths preserve recovery and inventory history.
-- Keep owner INSERT/UPDATE and their RLS; only close physical REST DELETE.
revoke delete on public.customers,public.products from authenticated;
commit;
