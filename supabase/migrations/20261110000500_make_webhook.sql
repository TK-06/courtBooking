-- Sends booking and loan changes to the Make.com "ITC booking log" scenario.
-- Payload matches Supabase Database Webhooks: {type, table, schema, record, old_record}.
-- The webhook URL is NOT stored in the repo. After applying, run as postgres:
--   insert into private.app_config (key, value)
--   values ('make_webhook_url', '<your Make custom webhook URL>');
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);

create or replace function private.notify_make()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare
  v_url text;
begin
  select value into v_url from private.app_config where key = 'make_webhook_url';
  if v_url is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return null;
end;
$$;

revoke all on function private.notify_make() from public, anon, authenticated;

create trigger bookings_notify_make
after insert or update on public.bookings
for each row execute function private.notify_make();

create trigger loans_notify_make
after insert or update on public.loans
for each row execute function private.notify_make();
