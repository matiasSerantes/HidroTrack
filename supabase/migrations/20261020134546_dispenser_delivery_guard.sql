begin;
create or replace function private.delivery_dispenser_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind in ('delivery','opening_customer') and exists(select 1 from jsonb_array_elements(new.items) i join public.products p on p.tenant_id=new.tenant_id and p.id=(i->>'product_id')::uuid where p.family='dispenser' and ((i->>'quantity')::numeric>0 or coalesce((i->>'returned')::numeric,0)>0)) then raise exception 'Usá asignación o devolución de dispenser para conservar sus equipos'; end if;
 return new;
end $$;
commit;
