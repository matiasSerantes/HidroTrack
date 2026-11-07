begin;
create table public.customer_combo_preferences(
 tenant_id uuid not null,customer_id uuid not null,combo_id uuid not null,quantity integer not null check(quantity between 1 and 100000),
 primary key(tenant_id,customer_id,combo_id),foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),foreign key(tenant_id,combo_id) references public.sale_combos(tenant_id,id)
);
alter table public.customer_combo_preferences enable row level security;
create policy customer_combo_preferences_owner on public.customer_combo_preferences for all to authenticated using(private.has_role(tenant_id,array['owner'])) with check(private.has_role(tenant_id,array['owner']));
revoke all on public.customer_combo_preferences from public,anon,authenticated;
grant select,insert,update,delete on public.customer_combo_preferences to authenticated;
create function private.validate_combo_preference() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.sale_combos c where c.tenant_id=new.tenant_id and c.id=new.combo_id and c.active and not exists(select 1 from jsonb_array_elements(c.items) i where not exists(select 1 from public.products p where p.tenant_id=c.tenant_id and p.id=(i->>'product_id')::uuid and p.active and p.family='article'))) then raise exception 'Promo no disponible para pedido habitual';end if;
 return new;
end $$;
revoke all on function private.validate_combo_preference() from public,anon,authenticated;
create trigger validate_combo_preference before insert or update on public.customer_combo_preferences for each row execute function private.validate_combo_preference();

-- Both kinds of preferences become physical quantities for load planning.
create view public.customer_load_preferences with(security_invoker=true) as
 select tenant_id,customer_id,product_id,sum(quantity)::bigint quantity from (
  select tenant_id,customer_id,product_id,quantity::bigint quantity from public.customer_product_preferences
  union all
  select h.tenant_id,h.customer_id,(i->>'product_id')::uuid,h.quantity::bigint*(i->>'quantity')::bigint
  from public.customer_combo_preferences h join public.sale_combos c on c.tenant_id=h.tenant_id and c.id=h.combo_id and c.active
  cross join lateral jsonb_array_elements(c.items) i
  where not exists(select 1 from jsonb_array_elements(c.items) part where not exists(select 1 from public.products p where p.tenant_id=c.tenant_id and p.id=(part->>'product_id')::uuid and p.active and p.family='article'))
 ) lines group by tenant_id,customer_id,product_id;
revoke all on public.customer_load_preferences from public,anon,authenticated;
grant select on public.customer_load_preferences to authenticated;

-- Preserve existing route gates, extraordinary-order overrides and load snapshots.
do $$
declare fn record; definition text;
begin
 for fn in select oid from pg_catalog.pg_proc where pronamespace='public'::regnamespace and proname in ('assistant_load_options','inventory_confirm_load') loop
  definition:=pg_get_functiondef(fn.oid);
  if position('public.customer_product_preferences' in definition)=0 then raise exception 'Contrato de sugerencia inesperado';end if;
  execute replace(definition,'public.customer_product_preferences','public.customer_load_preferences');
 end loop;
end $$;

create or replace function public.assistant_customer_visit(p_tenant uuid,p_trip uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; combos jsonb:='[]';
begin
 result:=private.customer_visit_before_combos(p_tenant,p_trip,p_customer);
 if private.has_role(p_tenant,array['owner']) or exists(select 1 from public.tenant_members where tenant_id=p_tenant and user_id=auth.uid() and active and promotion_allowed) then
  select coalesce(jsonb_agg(c||jsonb_build_object('usual_quantity',coalesce((select h.quantity from public.customer_combo_preferences h where h.tenant_id=p_tenant and h.customer_id=p_customer and h.combo_id=(c->>'id')::uuid),0))),'[]') into combos from jsonb_array_elements(private.available_sale_combos(p_tenant,p_trip)) c;
 end if;
 return result||jsonb_build_object('combos',combos);
end $$;
revoke all on function public.assistant_customer_visit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.assistant_customer_visit(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
