-- Run the whole file as postgres in the Supabase SQL editor after all four
-- migrations. Fixtures, temporary grants, and the clock override roll back.
-- nextval() calls consume sequence values even when a transaction rolls back.
begin;
set local timezone = 'UTC';
set local lc_time = 'C';

-- Pin only the hour, keeping dates relative to the real Bangkok calendar.
-- This makes the 1-hour / exactly-2-hour cutoff cases runnable after 22:00 too.
create or replace function public.bangkok_now()
returns timestamp
language sql stable
set search_path = public
as $$
  select date_trunc('day', now() at time zone 'Asia/Bangkok') + interval '13 hours';
$$;

create function pg_temp.expect_ok(sql text)
returns void
language plpgsql security invoker
as $$
begin
  execute sql;
exception when others then
  raise exception 'CHECK FAILED: expected success, got [%] %; SQL: %', sqlstate, sqlerrm, sql;
end;
$$;

create function pg_temp.expect_error(sql text, msg_like text)
returns void
language plpgsql security invoker
as $$
begin
  begin
    execute sql;
  exception when others then
    -- A five-character SQLSTATE checks structural / privilege failures.
    -- Shared rule messages must match both the text and SQLSTATE P0001.
    if (msg_like ~ '^[0-9A-Z]{5}$' and sqlstate = msg_like)
       or (sqlstate = 'P0001' and sqlerrm like msg_like) then
      return;
    end if;
    raise exception 'CHECK FAILED: expected %, got [%] %; SQL: %', msg_like, sqlstate, sqlerrm, sql;
  end;
  raise exception 'CHECK FAILED: expected error %, but statement succeeded; SQL: %', msg_like, sql;
end;
$$;

-- Explicit pg_temp lookup uses this session's schema across SET ROLE; only
-- function EXECUTE grants are needed (GRANT does not expand a pg_temp alias).
grant execute on function pg_temp.expect_ok(text), pg_temp.expect_error(text, text) to authenticated;

-- All email addresses below are synthetic test fixtures, never seed data.
insert into public.admin_emails (email) values ('admin-test@example.com');
insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 't1@student.chula.ac.th',
   '{"full_name":"Test One","student_id":"9900000001","role":"admin"}'::jsonb,
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 't2@student.chula.ac.th',
   '{"full_name":"Test Two","student_id":"9900000002"}'::jsonb,
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin-test@example.com',
   '{}'::jsonb,
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

do $$
begin
  if not exists (select 1 from public.profiles
      where id = '11111111-1111-4111-8111-111111111111' and role = 'student')
     or not exists (select 1 from public.profiles
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role = 'admin'
        and student_id is null and full_name = 'admin-test') then
    raise exception 'CHECK FAILED: signup must use the allowlist, not metadata roles';
  end if;
end;
$$;

-- A dedicated court avoids clashes with real bookings. Remove closures only
-- on the dates this script needs; the original rows are restored by ROLLBACK.
insert into public.courts (id, name, status) values (31001, 'Rules check court', 'open');
delete from public.closed_days where date in (
  public.bangkok_now()::date, public.bangkok_now()::date + 1,
  public.bangkok_now()::date + 2, public.bangkok_now()::date + 4,
  public.bangkok_now()::date + 5, public.bangkok_now()::date + 14,
  public.bangkok_now()::date + 15, public.bangkok_now()::date + 60,
  public.bangkok_now()::date + 90, public.bangkok_now()::date + 91
);
insert into public.closed_days (date, message)
values (public.bangkok_now()::date + 3, 'The courts are closed that day.')
on conflict (date) do update set message = excluded.message;

-- Give the test loan date exactly two free items of each kind regardless of
-- existing reservations. No existing booking, loan, event, or user is deleted.
update public.equipment e set total = 2 + (
  select coalesce(sum(case e.id when 'racket' then l.racket else l.balls end), 0)::integer
  from public.loans l
  where l.date = public.bangkok_now()::date + 5 and l.status in ('reserved', 'out')
);

-- 1. Student books tomorrow 18-20; supplied identity/code/status are replaced.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select pg_temp.expect_ok($sql$
  insert into public.bookings (user_id, code, court_id, date, start_hour, end_hour, status, cancelled_by)
  values ('22222222-2222-4222-8222-222222222222', 'forged', 31001,
    public.bangkok_now()::date + 1, 18, 20, 'cancelled', 'club')
$sql$);
do $$
begin
  if not exists (select 1 from public.bookings where court_id = 31001
      and date = public.bangkok_now()::date + 1 and start_hour = 18
      and user_id = auth.uid() and status = 'confirmed' and cancelled_by is null
      and code ~ '^ITC-\d{4}-\d{4}$'
      and split_part(code, '-', 2) = to_char(date, 'MMDD')) then
    raise exception 'CHECK FAILED: case 1 generated booking fields';
  end if;
end;
$$;
reset role;

-- 2. A third confirmed hour on that date fails, even in another row.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 1, 20, 21)
$sql$, 'You can book up to 2 hours a day.');
reset role;

-- 3. Another member overlaps. The trigger must give the exact taken message.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 1, 19, 20)
$sql$, 'Someone just took one of those hours. Pick again.');
reset role;

-- 4. Student/admin booking windows, including their inclusive final dates.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 15, 18, 19)
$sql$, 'You can book up to 14 days ahead.');
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 14, 18, 19)
$sql$);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 60, 8, 12, 'Club training')
$sql$);
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 90, 8, 9, 'Club training')
$sql$);
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 91, 8, 9, 'Club training')
$sql$, 'Club bookings can go up to 90 days ahead.');
-- Additional required cases: admins need a purpose and cannot displace a member.
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 2, 18, 19)
$sql$, 'Add a short title, such as Club training or Inter-faculty match.');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 2, 18, 19, '   ')
$sql$, 'Add a short title, such as Club training or Inter-faculty match.');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 2, 18, 19, repeat('x', 61))
$sql$, 'Add a short title, such as Club training or Inter-faculty match.');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 1, 19, 20, 'Club training')
$sql$, 'Someone just took one of those hours. Pick again.');
reset role;

-- 5. Purpose, court/day closures, structural hours, past and adjacent hours.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour, purpose)
  values (31001, public.bangkok_now()::date + 2, 18, 19, 'Student title')
$sql$, 'Only club admins can add a title.');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (2, public.bangkok_now()::date + 2, 18, 19)
$sql$, 'That court is closed.');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 3, 18, 19)
$sql$, 'The courts are closed that day.');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 2, 21, 23)
$sql$, '23514');
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date, 13, 14)
$sql$, 'That hour has already started.');
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 2, 8, 9)
$sql$);
select pg_temp.expect_error($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 2, 10, 11)
$sql$, 'Hours on the same day have to be back to back.');
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 2, 9, 10)
$sql$);
-- A separate date confirms the last valid start can end at 22:00.
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date + 4, 21, 22)
$sql$);
reset role;

-- 6. Student cancellation: one hour is too late; others' rows are filtered.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_ok($sql$
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (31001, public.bangkok_now()::date, 14, 15),
         (31001, public.bangkok_now()::date, 15, 16)
$sql$);
select pg_temp.expect_error($sql$
  update public.bookings set status = 'cancelled'
  where court_id = 31001 and date = public.bangkok_now()::date and start_hour = 14
$sql$, 'Cancelling closed 2 hours before the start time.');
do $$
declare v_changed integer;
begin
  update public.bookings set status = 'cancelled'
  where user_id = '11111111-1111-4111-8111-111111111111'
    and court_id = 31001 and date = public.bangkok_now()::date + 1;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then
    raise exception 'CHECK FAILED: case 6 student updated another member booking';
  end if;
end;
$$;
select pg_temp.expect_error($sql$
  update public.bookings set status = 'cancelled', end_hour = 10
  where court_id = 31001 and date = public.bangkok_now()::date + 2 and start_hour = 8
$sql$, 'Only cancelling is allowed.');
reset role;

-- At 13:01, the 15:00 booking is only 1h59 away.
create or replace function public.bangkok_now()
returns timestamp language sql stable set search_path = public
as $$ select date_trunc('day', now() at time zone 'Asia/Bangkok') + interval '13 hours 1 minute'; $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  update public.bookings set status = 'cancelled'
  where court_id = 31001 and date = public.bangkok_now()::date and start_hour = 15
$sql$, 'Cancelling closed 2 hours before the start time.');
reset role;
create or replace function public.bangkok_now()
returns timestamp language sql stable set search_path = public
as $$ select date_trunc('day', now() at time zone 'Asia/Bangkok') + interval '13 hours'; $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_ok($sql$
  update public.bookings set status = 'cancelled', cancelled_by = 'club', cancelled_at = '2000-01-01'
  where court_id = 31001 and date = public.bangkok_now()::date and start_hour = 15
$sql$);
do $$
begin
  if not exists (select 1 from public.bookings where court_id = 31001
      and date = public.bangkok_now()::date and start_hour = 15
      and status = 'cancelled' and cancelled_by = 'member' and cancelled_at = now()) then
    raise exception 'CHECK FAILED: case 6 exact cutoff / server cancellation fields';
  end if;
end;
$$;
reset role;

-- 7. Admin cancelling another member requires reason and the generic DB note.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  update public.bookings set status = 'cancelled', cancel_reason = 'Weather', cancel_note = 'short'
  where court_id = 31001 and date = public.bangkok_now()::date + 1 and start_hour = 18
$sql$, 'Write at least a sentence so the member knows why.');
select pg_temp.expect_error($sql$
  update public.bookings set status = 'cancelled', cancel_note = 'Rain has flooded the court.'
  where court_id = 31001 and date = public.bangkok_now()::date + 1 and start_hour = 18
$sql$, 'Pick a reason.');
select pg_temp.expect_ok($sql$
  update public.bookings set status = 'cancelled', cancel_reason = 'Weather',
    cancel_note = 'Rain has flooded the court.'
  where court_id = 31001 and date = public.bangkok_now()::date and start_hour = 14
$sql$);
do $$
begin
  if not exists (select 1 from public.bookings where court_id = 31001
      and date = public.bangkok_now()::date and start_hour = 14
      and status = 'cancelled' and cancelled_by = 'club' and cancelled_at = now()) then
    raise exception 'CHECK FAILED: case 7 admin bypasses cutoff and records club cancellation';
  end if;
end;
$$;
-- Decisions allow an admin's own cancellation without a reason or note.
select pg_temp.expect_ok($sql$
  update public.bookings set status = 'cancelled'
  where court_id = 31001 and date = public.bangkok_now()::date + 60
$sql$);
reset role;

-- 8. Signup validation fires from real auth.users inserts, as postgres.
select pg_temp.expect_error($sql$
  insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
  values ('44444444-4444-4444-8444-444444444444', 'rejected-test@example.com',
    '{"student_id":"9900000004"}'::jsonb, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated')
$sql$, 'Use your Chula student email, the one ending in @student.chula.ac.th.');
select pg_temp.expect_ok($sql$
  insert into auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
  values ('33333333-3333-4333-8333-333333333333', ' T3@Student.Chula.ac.th ',
    '{"student_id":"9900000003"}'::jsonb, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated')
$sql$);
do $$
begin
  if not exists (select 1 from public.profiles
      where id = '33333333-3333-4333-8333-333333333333'
        and role = 'student' and full_name = 't3') then
    raise exception 'CHECK FAILED: case 8 normalized email / fallback full_name';
  end if;
end;
$$;

-- 9. Loan maxima, empty selection, window, closure, duplicate and status rules.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 5, 3, 0)
$sql$, 'Up to 2 rackets a day.');
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 5, 0, 3)
$sql$, 'Up to 2 cans of balls a day.');
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 5, 0, 0)
$sql$, 'Choose a racket or a can of balls first.');
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 7, 1, 0)
$sql$, '23514');
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date - 1, 1, 0)
$sql$, '23514');
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 3, 1, 0)
$sql$, 'The courts are closed that day.');
select pg_temp.expect_ok($sql$
  insert into public.loans (user_id, date, racket, balls, status)
  values ('22222222-2222-4222-8222-222222222222', public.bangkok_now()::date + 5, 1, 1, 'out')
$sql$);
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 5, 1, 0)
$sql$, format('You already have equipment reserved for %s.',
  to_char(public.bangkok_now()::date + 5, 'Dy FMDD Mon')));
do $$
declare v_changed integer;
begin
  if not exists (select 1 from public.loans where user_id = auth.uid()
      and date = public.bangkok_now()::date + 5 and status = 'reserved') then
    raise exception 'CHECK FAILED: case 9 loan identity/status not forced';
  end if;
  update public.loans set status = 'out'
  where user_id = auth.uid() and date = public.bangkok_now()::date + 5;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then
    raise exception 'CHECK FAILED: case 9 student changed loan status';
  end if;
end;
$$;
reset role;

-- This member cannot see the first loan, but availability enforcement must.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  insert into public.loans (date, racket, balls)
  values (public.bangkok_now()::date + 5, 2, 0)
$sql$, 'Only 1 free that day.');
do $$
begin
  if exists (select 1 from public.loans where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'CHECK FAILED: loan RLS exposes another member';
  end if;
end;
$$;
reset role;

-- 10. Read helper returns both kinds without exposing the underlying loans.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.equipment_available(public.bangkok_now()::date)) <> 2
     or exists (select 1 from public.equipment_available(public.bangkok_now()::date)
       where free > total)
     or (select count(*) from public.equipment_available(public.bangkok_now()::date + 5)
       where free = 1 and free <= total) <> 2 then
    raise exception 'CHECK FAILED: case 10 equipment availability';
  end if;
end;
$$;
-- Additional required case: non-admin App event insertion must fail via RLS.
select pg_temp.expect_error($sql$
  insert into public.booking_events (user_id, kind, text, source)
  values (auth.uid(), 'court.closed', 'Test closure', 'App')
$sql$, '42501');
select pg_temp.expect_error('select * from public.admin_emails', '42501');
reset role;

-- Only the admin may advance a loan, one step at a time; returns free stock.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
select pg_temp.expect_error($sql$
  update public.loans set status = 'returned'
  where user_id = '11111111-1111-4111-8111-111111111111' and date = public.bangkok_now()::date + 5
$sql$, '23514');
select pg_temp.expect_ok($sql$
  update public.loans set status = 'out'
  where user_id = '11111111-1111-4111-8111-111111111111' and date = public.bangkok_now()::date + 5
$sql$);
select pg_temp.expect_error($sql$
  update public.loans set status = 'returned', racket = 0
  where user_id = '11111111-1111-4111-8111-111111111111' and date = public.bangkok_now()::date + 5
$sql$, '23514');
select pg_temp.expect_ok($sql$
  update public.loans set status = 'returned'
  where user_id = '11111111-1111-4111-8111-111111111111' and date = public.bangkok_now()::date + 5
$sql$);
do $$
begin
  if (select count(*) from public.equipment_available(public.bangkok_now()::date + 5) where free = 2) <> 2 then
    raise exception 'CHECK FAILED: returning a loan must restore availability';
  end if;
end;
$$;
select pg_temp.expect_ok($sql$
  insert into public.booking_events (user_id, kind, text, source)
  values (auth.uid(), 'court.closed', 'Test closure', 'App')
$sql$);
select pg_temp.expect_error($sql$
  insert into public.booking_events (user_id, kind, text, source)
  values (auth.uid(), 'booking.created', 'Test booking', 'App')
$sql$, '42501');
select pg_temp.expect_error($sql$
  insert into public.booking_events (user_id, kind, text)
  values (auth.uid(), 'court.closed', 'Test closure')
$sql$, '42501');
reset role;

-- Inspect the race backstop without pretending a single transaction can race.
do $$
begin
  if not exists (select 1 from pg_constraint
      where conrelid = 'public.bookings'::regclass
        and conname = 'bookings_no_overlap' and contype = 'x') then
    raise exception 'CHECK FAILED: missing bookings_no_overlap exclusion constraint';
  end if;
  raise notice 'all rules checks passed';
end;
$$;
rollback;
