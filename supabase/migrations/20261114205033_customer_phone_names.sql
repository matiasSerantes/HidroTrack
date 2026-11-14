begin;
alter table public.customers add column phone2_name text not null default '' check(length(phone2_name)<=100);
alter table public.customers add column phone3_name text not null default '' check(length(phone3_name)<=100);
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.assistant_customer_visit(uuid,uuid,uuid)'::regprocedure);
 if position('''phone2'',c.phone2,''phone3'',c.phone3' in definition)=0 then raise exception 'Contrato de contactos inesperado';end if;
 execute replace(definition,'''phone2'',c.phone2,''phone3'',c.phone3','''phone2'',c.phone2,''phone3'',c.phone3,''phone2_name'',c.phone2_name,''phone3_name'',c.phone3_name');
end $$;
notify pgrst,'reload schema';
commit;
