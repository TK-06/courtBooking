-- 1. The one-click demo (an anonymous sign-in) can look around but not book.
-- 2. Equipment loans are for Chula students: guests cannot reserve.
-- 3. Members only read their own booking rows. Everyone else's hours come from
--    court_bookings(), which hides who booked, the code and any cancel notes
--    unless the row is yours or you are an admin.

-- Guard triggers are named with a leading 0 so they fire before the existing
-- *_before_* triggers (Postgres fires same-event triggers in name order).
create or replace function public.refuse_demo_booking()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if exists (select 1 from auth.users u where u.id = auth.uid() and u.is_anonymous) then
    raise exception '%', 'The demo can look around but not book. Create a free guest account to book 1 hour a week.';
  end if;
  return new;
end;
$$;

create trigger bookings_0_refuse_demo
before insert on public.bookings
for each row execute function public.refuse_demo_booking();

create or replace function public.refuse_guest_loan()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guest') then
    raise exception '%', 'Equipment loans are for Chula students.';
  end if;
  return new;
end;
$$;

create trigger loans_0_refuse_guest
before insert on public.loans
for each row execute function public.refuse_guest_loan();

revoke all on function public.refuse_demo_booking() from public, anon, authenticated;
revoke all on function public.refuse_guest_loan() from public, anon, authenticated;

-- Other members' bookings: court, date, hours, status and club titles only.
create or replace function public.court_bookings(p_from date, p_to date)
returns setof public.bookings
language sql stable security definer
set search_path = public
as $$
  select b.id,
    case when v.see_all then b.code end,
    case when v.see_all then b.user_id end,
    b.court_id, b.date, b.start_hour, b.end_hour, b.status, b.purpose,
    case when v.see_all then b.cancel_reason end,
    case when v.see_all then b.cancel_note end,
    case when v.see_all then b.cancelled_by end,
    case when v.see_all then b.cancelled_at end,
    b.created_at
  from public.bookings b
  cross join lateral (
    select b.user_id = (select auth.uid()) or (select public.is_admin()) as see_all
  ) v
  where b.date between p_from and p_to;
$$;

revoke all on function public.court_bookings(date, date) from public, anon, authenticated;
grant execute on function public.court_bookings(date, date) to authenticated;

-- The table policy is tightened in 20261126001100_private_bookings_policy.sql, applied
-- only after the frontend that reads court_bookings() is deployed. Before that, the old
-- frontend still reads the table directly for availability.
