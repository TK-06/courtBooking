create function public.bangkok_now()
returns timestamp
language sql stable
set search_path = public
as $$
  select now() at time zone 'Asia/Bangkok';
$$;

create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.email));
  v_role text := 'student';
begin
  if exists (select 1 from public.admin_emails a where a.email = v_email) then
    v_role := 'admin';
  elsif v_email is null or v_email not like '%@student.chula.ac.th' then
    raise exception '%', 'Use your Chula student email, the one ending in @student.chula.ac.th.';
  end if;

  insert into public.profiles (id, full_name, student_id, program, year, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'student_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'program'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'year'), '')::integer,
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.bookings_before_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_today date := public.bangkok_now()::date;
  v_hours integer;
begin
  new.user_id := auth.uid();
  new.status := 'confirmed';
  new.cancel_reason := null;
  new.cancel_note := null;
  new.cancelled_by := null;
  new.cancelled_at := null;

  -- Serialize a member's inserts before reading their accumulated daily hours.
  perform 1 from public.profiles p where p.id = new.user_id for update;

  -- Give ordinary conflicts the shared message before any other rule error.
  -- bookings_no_overlap still catches concurrent inserts by different members.
  if exists (
    select 1 from public.bookings b
    where b.court_id = new.court_id and b.date = new.date
      and b.status = 'confirmed'
      and b.start_hour < new.end_hour and new.start_hour < b.end_hour
  ) then
    raise exception '%', 'Someone just took one of those hours. Pick again.';
  end if;

  if v_admin then
    if new.purpose is null or trim(new.purpose) = '' or char_length(new.purpose) > 60 then
      raise exception '%', 'Add a short title, such as Club training or Inter-faculty match.';
    end if;
  elsif new.purpose is not null then
    raise exception '%', 'Only club admins can add a title.';
  end if;

  if not exists (select 1 from public.courts c where c.id = new.court_id and c.status = 'open') then
    raise exception '%', 'That court is closed.';
  end if;
  if exists (select 1 from public.closed_days d where d.date = new.date) then
    raise exception '%', 'The courts are closed that day.';
  end if;
  if (new.date + new.start_hour * interval '1 hour') <= public.bangkok_now() then
    raise exception '%', 'That hour has already started.';
  end if;
  if v_admin and new.date > v_today + 90 then
    raise exception '%', 'Club bookings can go up to 90 days ahead.';
  elsif not v_admin and new.date > v_today + 14 then
    raise exception '%', 'You can book up to 14 days ahead.';
  end if;

  if not v_admin then
    select coalesce(sum(b.end_hour - b.start_hour), 0)::integer into v_hours
    from public.bookings b
    where b.user_id = new.user_id and b.date = new.date and b.status = 'confirmed';
    if v_hours + new.end_hour - new.start_hour > 2 then
      raise exception '%', 'You can book up to 2 hours a day.';
    end if;
    if v_hours > 0 and not exists (
      select 1 from public.bookings b
      where b.user_id = new.user_id and b.date = new.date and b.status = 'confirmed'
        and (b.end_hour = new.start_hour or b.start_hour = new.end_hour)
    ) then
      raise exception '%', 'Hours on the same day have to be back to back.';
    end if;
  end if;

  new.code := 'ITC-' || to_char(new.date, 'MMDD') || '-'
    || lpad(nextval('public.booking_code_seq')::text, 4, '0');
  return new;
end;
$$;

create trigger bookings_before_insert
before insert on public.bookings
for each row execute function public.bookings_before_insert();

create function public.bookings_before_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_cancel_columns text[] := array[
    'status', 'cancel_reason', 'cancel_note', 'cancelled_by', 'cancelled_at'
  ];
begin
  if old.status <> 'confirmed' or new.status is distinct from 'cancelled'
     or (to_jsonb(new) - v_cancel_columns) is distinct from (to_jsonb(old) - v_cancel_columns) then
    raise exception '%', 'Only cancelling is allowed.';
  end if;

  if not v_admin then
    if old.user_id is distinct from auth.uid() then
      raise exception '%', 'Only cancelling is allowed.';
    end if;
    if (old.date + old.start_hour * interval '1 hour') - public.bangkok_now() < interval '2 hours' then
      raise exception '%', 'Cancelling closed 2 hours before the start time.';
    end if;
  elsif old.user_id is distinct from auth.uid() then
    if new.cancel_reason is null then
      raise exception '%', 'Pick a reason.';
    end if;
    if coalesce(char_length(trim(new.cancel_note)), 0) < 15 then
      raise exception '%', 'Write at least a sentence so the member knows why.';
    end if;
  end if;

  new.cancelled_by := case when v_admin and old.user_id is distinct from auth.uid()
    then 'club' else 'member' end;
  new.cancelled_at := now();
  return new;
end;
$$;

create trigger bookings_before_update
before update on public.bookings
for each row execute function public.bookings_before_update();

create function public.loans_before_write()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := public.bangkok_now()::date;
  v_item record;
  v_quantity integer;
  v_free integer;
begin
  if tg_op = 'UPDATE' then
    if not public.is_admin() then
      raise insufficient_privilege using message = 'permission denied for table loans';
    end if;
    -- Status transitions must remain possible after the loan's reservation date.
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
       or not ((old.status = 'reserved' and new.status = 'out')
         or (old.status = 'out' and new.status = 'returned')) then
      raise check_violation using
        message = 'new row for relation "loans" violates check constraint "loans_status_transition"',
        constraint = 'loans_status_transition', table = 'loans', schema = 'public';
    end if;
    return new;
  end if;

  new.user_id := auth.uid();
  new.status := 'reserved';
  -- There is no loan-window string in MESSAGES. Treat its date bounds like
  -- structural hour bounds (23514), without inventing user-facing copy.
  if new.date < v_today or new.date > v_today + 6 then
    raise check_violation using
      message = 'new row for relation "loans" violates check constraint "loans_date_window"',
      constraint = 'loans_date_window', table = 'loans', schema = 'public';
  end if;
  if exists (select 1 from public.closed_days d where d.date = new.date) then
    raise exception '%', 'The courts are closed that day.';
  end if;

  -- A consistent lock order serializes both stock and duplicate checks. The
  -- definer can count other members' loans without exposing their rows via RLS.
  perform e.id from public.equipment e order by e.id for update;
  for v_item in select e.* from public.equipment e order by e.id desc loop
    v_quantity := case v_item.id when 'racket' then new.racket else new.balls end;
    if v_quantity > v_item.max_per_day then
      raise exception '%', format('Up to %s %s a day.', v_item.max_per_day, lower(v_item.plural));
    end if;
  end loop;

  if new.racket + new.balls = 0 then
    raise exception '%', 'Choose a racket or a can of balls first.';
  end if;
  if exists (
    select 1 from public.loans l
    where l.user_id = new.user_id and l.date = new.date and l.status <> 'returned'
  ) then
    raise exception '%', format('You already have equipment reserved for %s.', to_char(new.date, 'Dy FMDD Mon'));
  end if;

  for v_item in select e.* from public.equipment e order by e.id desc loop
    v_quantity := case v_item.id when 'racket' then new.racket else new.balls end;
    select (v_item.total - coalesce(sum(
      case v_item.id when 'racket' then l.racket else l.balls end
    ), 0))::integer into v_free
    from public.loans l where l.date = new.date and l.status in ('reserved', 'out');
    if v_quantity > v_free then
      raise exception '%', format('Only %s free that day.', v_free);
    end if;
  end loop;
  return new;
end;
$$;

create trigger loans_before_write
before insert or update on public.loans
for each row execute function public.loans_before_write();

create function public.equipment_available(p_date date)
returns table(id text, total integer, free integer)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.total,
    (e.total - coalesce(sum(case e.id when 'racket' then l.racket else l.balls end), 0))::integer as free
  from public.equipment e
  left join public.loans l on l.date = p_date and l.status in ('reserved', 'out')
  group by e.id, e.total
  order by e.id;
$$;

-- Trigger functions are not RPCs. Only the three read helpers are executable
-- by authenticated clients; trigger execution does not require that grant.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.bookings_before_insert() from public, anon, authenticated;
revoke all on function public.bookings_before_update() from public, anon, authenticated;
revoke all on function public.loans_before_write() from public, anon, authenticated;
revoke all on function public.bangkok_now() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.equipment_available(date) from public, anon, authenticated;
grant execute on function public.bangkok_now(), public.is_admin(), public.equipment_available(date)
  to authenticated;
