begin;
alter table public.customers add column phone4 text not null default '' check(length(phone4)<=40), add column phone4_name text not null default '' check(length(phone4_name)<=100);
alter table public.customers add column phone5 text not null default '' check(length(phone5)<=40), add column phone5_name text not null default '' check(length(phone5_name)<=100);
alter table public.customers add column phone6 text not null default '' check(length(phone6)<=40), add column phone6_name text not null default '' check(length(phone6_name)<=100);
alter table public.promotions drop constraint promotions_terms_check;
alter table public.promotions add constraint promotions_terms_check check(length(trim(terms))<=1000);
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.assistant_customer_visit(uuid,uuid,uuid)'::regprocedure);
 if position('''phone3_name'',c.phone3_name' in definition)=0 then raise exception 'Unexpected contact contract'; end if;
 execute replace(definition,'''phone3_name'',c.phone3_name','''phone3_name'',c.phone3_name,''phone4'',c.phone4,''phone4_name'',c.phone4_name,''phone5'',c.phone5,''phone5_name'',c.phone5_name,''phone6'',c.phone6,''phone6_name'',c.phone6_name');
end $$;
notify pgrst,'reload schema';
commit;
