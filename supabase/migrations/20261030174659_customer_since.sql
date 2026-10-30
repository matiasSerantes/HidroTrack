-- Historical service start is independent from the timestamp of data entry.
-- Existing customers remain unknown until their owner supplies the date.
alter table public.customers add column customer_since date;
alter table public.customers add constraint customers_since_valid check (
 customer_since is null or (
  isfinite(customer_since) and customer_since >= date '1900-01-01'
  and customer_since <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
 )
);
comment on column public.customers.customer_since is 'Optional historical start of service, supplied by the owner; created_at remains the data-entry timestamp.';
