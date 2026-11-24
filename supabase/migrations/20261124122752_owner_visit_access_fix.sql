begin;
do $$ declare signature text;definition text;begin
 foreach signature in array array['public.assistant_record_visit_at(uuid,uuid,uuid,uuid,integer,text,text,date,text,time)','public.assistant_record_visit(uuid,uuid,uuid,uuid,integer,text,text,date,text)','public.assistant_customer_debts(uuid,uuid,uuid)','public.assistant_collect_debt(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('private.accepted_trip_access(p_tenant,p_trip)' in definition)>0 then execute replace(definition,'private.accepted_trip_access(p_tenant,p_trip)','private.operational_trip_access(p_tenant,p_trip)');
  elsif position('private.operational_trip_access(p_tenant,p_trip)' in definition)=0 then raise exception 'Unexpected visit access contract';end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
