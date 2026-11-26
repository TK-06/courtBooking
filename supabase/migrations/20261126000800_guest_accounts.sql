-- Guest accounts: anyone can sign up with any email, or try the demo with an
-- anonymous sign-in. Guests can book 1 hour a week (Monday to Sunday, Bangkok).
-- Chula students keep 2 hours a day; admins are unchanged.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'admin', 'guest'));

alter table public.profiles drop constraint profiles_student_id_check;
alter table public.profiles add constraint profiles_student_id_check
  check (role in ('admin', 'guest') or student_id ~ '^\d{10}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.email));
  v_role text := 'guest';
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if v_email is not null and exists (select 1 from public.admin_emails a where a.email = v_email) then
    v_role := 'admin';
  elsif v_email like '%@student.chula.ac.th' then
    v_role := 'student';
  end if;

  -- Guests (any other email, or an anonymous demo user with no email) never get
  -- student details: student_id is unique, so a guest must not be able to claim one.
  insert into public.profiles (id, full_name, student_id, faculty, program, year, role)
  values (
    new.id,
    coalesce(nullif(trim(v_meta ->> 'full_name'), ''), nullif(split_part(v_email, '@', 1), ''), 'Guest'),
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'student_id'), '') end,
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'faculty'), '') end,
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'program'), '') end,
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'year'), '')::integer end,
    v_role
  );
  return new;
end;
$$;

create or replace function public.bookings_before_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_guest boolean;
  v_today date := public.bangkok_now()::date;
  v_week date := date_trunc('week', new.date)::date;
  v_hours integer;
begin
  new.user_id := auth.uid();
  new.status := 'confirmed';
  new.cancel_reason := null;
  new.cancel_note := null;
  new.cancelled_by := null;
  new.cancelled_at := null;

  -- Serialize a member's inserts before reading their accumulated hours.
  perform 1 from public.profiles p where p.id = new.user_id for update;
  select p.role = 'guest' into v_guest from public.profiles p where p.id = new.user_id;

  if exists (
    select 1 from public.bookings b
    where b.court_id = new.court_id and b.date = new.date
      and b.status = 'confirmed'
      and b.start_hour < new.end_hour and new.start_hour < b.end_hour
  ) then
    raise exception '%', 'Someone just took one of those hours. Pick again.';
  end if;

  if v_admin then
    new.purpose := nullif(trim(new.purpose), '');
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

  if v_guest then
    select coalesce(sum(b.end_hour - b.start_hour), 0)::integer into v_hours
    from public.bookings b
    where b.user_id = new.user_id and b.status = 'confirmed'
      and b.date between v_week and v_week + 6;
    if v_hours + new.end_hour - new.start_hour > 1 then
      raise exception '%', 'Guests can book 1 hour a week.';
    end if;
  elsif not v_admin then
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

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.bookings_before_insert() from public, anon, authenticated;
