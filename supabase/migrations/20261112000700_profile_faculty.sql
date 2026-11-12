-- Sign-up now asks for the faculty. Engineering students pick one of the
-- faculty's 21 program codes; other faculties type their program.
alter table public.profiles add column if not exists faculty text;

create or replace function public.handle_new_user()
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

  insert into public.profiles (id, full_name, student_id, faculty, program, year, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'student_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'faculty'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'program'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'year'), '')::integer,
    v_role
  );
  return new;
end;
$$;

update public.profiles set faculty = 'Engineering' where faculty is null and role = 'student';
