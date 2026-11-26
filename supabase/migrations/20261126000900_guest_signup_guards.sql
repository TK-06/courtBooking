-- Guards on top of guest accounts (20261126000800):
-- 1. The student form (it sends a student_id) with a non-Chula, non-admin email is
--    refused as before, so a student never silently becomes a guest.
-- 2. A Chula address must come with a 10-digit student ID: no ID-less students.
-- 3. Each anonymous demo user gets its own name ("Demo guest 4F2A") so admins can
--    tell them apart.
-- 4. The student_id check no longer passes on NULL for students.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.email));
  v_role text := 'guest';
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_sid text := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'student_id'), '');
  v_name text;
begin
  if v_email is not null and exists (select 1 from public.admin_emails a where a.email = v_email) then
    v_role := 'admin';
  elsif v_email like '%@student.chula.ac.th' then
    v_role := 'student';
    if v_sid is null or v_sid !~ '^\d{10}$' then
      raise exception '%', 'Enter your full name and your 10-digit student ID.';
    end if;
  elsif v_sid is not null then
    raise exception '%', 'Use your Chula student email, the one ending in @student.chula.ac.th.';
  end if;

  v_name := coalesce(nullif(trim(v_meta ->> 'full_name'), ''), nullif(split_part(v_email, '@', 1), ''), 'Guest');
  if coalesce(new.is_anonymous, false) then
    v_name := 'Demo guest ' || upper(left(replace(new.id::text, '-', ''), 4));
  end if;

  -- Guests (any other email, or an anonymous demo user with no email) never get
  -- student details: student_id is unique, so a guest must not be able to claim one.
  insert into public.profiles (id, full_name, student_id, faculty, program, year, role)
  values (
    new.id,
    v_name,
    case when v_role = 'guest' then null else v_sid end,
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'faculty'), '') end,
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'program'), '') end,
    case when v_role = 'guest' then null else nullif(trim(v_meta ->> 'year'), '')::integer end,
    v_role
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles drop constraint profiles_student_id_check;
alter table public.profiles add constraint profiles_student_id_check
  check (role in ('admin', 'guest') or (student_id is not null and student_id ~ '^\d{10}$'));
