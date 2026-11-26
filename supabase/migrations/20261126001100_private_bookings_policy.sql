-- Members only read their own booking rows; admins read all. Everyone else's hours
-- come from court_bookings() (20261126001000), which hides who booked, the code
-- and cancel notes.
-- Apply AFTER the frontend that calls court_bookings() is live: the older frontend
-- reads this table directly to show which hours are taken.
drop policy bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
