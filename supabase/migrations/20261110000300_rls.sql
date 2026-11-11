-- RLS was enabled on all eight tables in the schema migration.
-- admin_emails intentionally has no policies and no client grants.
grant usage on schema public to authenticated, service_role;
revoke all on table public.admin_emails, public.profiles, public.courts,
  public.closed_days, public.bookings, public.equipment, public.loans,
  public.booking_events from public, anon, authenticated;
revoke all on sequence public.booking_code_seq, public.booking_events_id_seq
  from public, anon, authenticated;

grant select on public.profiles, public.courts, public.closed_days, public.bookings,
  public.equipment, public.loans, public.booking_events to authenticated;
grant insert, update on public.bookings, public.loans to authenticated;
grant update on public.courts, public.closed_days to authenticated;
grant insert on public.booking_events to authenticated;
grant usage on sequence public.booking_events_id_seq to authenticated;

-- Make.com writes events with the service role, which bypasses RLS.
grant select, insert on public.booking_events to service_role;
grant usage, select on sequence public.booking_events_id_seq to service_role;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy courts_read on public.courts for select to authenticated using (true);
create policy courts_admin_update on public.courts for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy closed_days_read on public.closed_days for select to authenticated using (true);
create policy closed_days_admin_update on public.closed_days for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy bookings_read on public.bookings for select to authenticated using (true);
create policy bookings_insert_own on public.bookings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy bookings_cancel on public.bookings for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy equipment_read on public.equipment for select to authenticated using (true);

create policy loans_read on public.loans for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy loans_insert_own on public.loans for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy loans_admin_update on public.loans for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy booking_events_read on public.booking_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy booking_events_admin_insert on public.booking_events for insert to authenticated
  with check ((select public.is_admin()) and source = 'App' and kind like 'court.%');
