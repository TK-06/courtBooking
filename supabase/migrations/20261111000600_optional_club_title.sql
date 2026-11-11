-- Admins no longer have to give a title. The app marks club bookings with
-- purpose = 'Club booking'; admins booking from student view leave it null.
-- Students still cannot set a purpose.
create or replace function public.bookings_before_insert()
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

  perform 1 from public.profiles p where p.id = new.user_id for update;

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
