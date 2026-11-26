-- Guest accounts and the 1-hour-a-week guest limit.
-- Run as postgres (Supabase SQL editor or MCP). Everything happens inside one
-- DO block that always ends by raising, so every fixture rolls back.
-- Success ends with: GUEST CHECKS PASSED (rolled back)
-- Needs migrations through 20261126001100 (check 12 tests that bookings policy).
do $$
declare
  v_guest uuid := gen_random_uuid();
  v_squat uuid := gen_random_uuid();
  v_anon uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_today date := public.bangkok_now()::date;
  -- Monday of next week and of the week after; both within the 14-day window.
  v_wk1 date := date_trunc('week', v_today)::date + 7;
  v_wk2 date := date_trunc('week', v_today)::date + 14;
  v_p record;
  v_first uuid;
  -- A random ID so the fixture never collides with a real member.
  v_sid text := '69' || lpad((floor(random() * 1e8))::bigint::text, 8, '0');
begin
  -- Free every slot the checks use, so real bookings cannot collide with them.
  -- The cancel trigger would refuse a postgres-side cancel, so it is paused for
  -- this one statement (the whole block rolls back anyway).
  alter table public.bookings disable trigger bookings_before_update;
  update public.bookings set status = 'cancelled'
  where status = 'confirmed' and date in (v_wk1, v_wk1 + 1, v_wk1 + 2, v_wk2)
    and court_id = 1 and start_hour between 8 and 11;
  alter table public.bookings enable trigger bookings_before_update;
  update public.courts set status = 'open' where id = 1;
  delete from public.closed_days where date in (v_wk1, v_wk1 + 1, v_wk1 + 2, v_wk2);

  -- 1. Any non-Chula email signs up as a guest.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_guest, 'Jane-' || v_sid || '@Company.com', '{"full_name":"Jane Recruiter"}');
  select * into v_p from public.profiles where id = v_guest;
  if v_p.role <> 'guest' or v_p.full_name <> 'Jane Recruiter' or v_p.student_id is not null then
    raise exception 'CHECK FAILED 1: %', row_to_json(v_p);
  end if;

  -- 2. The student form with a non-Chula email is refused, as before guests existed,
  --    so a student never silently becomes a guest (and nobody claims a student ID).
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_squat, 'guest-check-' || v_sid || '@gmail.com', '{"full_name":"X","student_id":"6600000000","faculty":"Engineering","program":"ICE","year":"3"}');
    raise exception 'CHECK FAILED 2: student-form sign-up with a Gmail address was accepted';
  exception when others then
    if sqlerrm <> 'Use your Chula student email, the one ending in @student.chula.ac.th.' then
      raise exception 'CHECK FAILED 2: %', sqlerrm;
    end if;
  end;

  -- 2b. A Chula address without a student ID is refused (no ID-less students).
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_squat, 'x' || v_sid || '@student.chula.ac.th', '{"full_name":"X"}');
    raise exception 'CHECK FAILED 2b: Chula sign-up without a student ID was accepted';
  exception when others then
    if sqlerrm <> 'Enter your full name and your 10-digit student ID.' then
      raise exception 'CHECK FAILED 2b: %', sqlerrm;
    end if;
  end;

  -- 3. An anonymous (demo) user has no email and becomes a guest with its own name.
  insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
  values (v_anon, null, true, '{"full_name":"Demo guest"}');
  select * into v_p from public.profiles where id = v_anon;
  if v_p.role <> 'guest' or v_p.full_name <> 'Demo guest ' || upper(left(replace(v_anon::text, '-', ''), 4)) then
    raise exception 'CHECK FAILED 3: %', row_to_json(v_p);
  end if;

  -- 4. Chula students are still students.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_student, v_sid || '@student.chula.ac.th', jsonb_build_object('full_name', 'S', 'student_id', v_sid, 'faculty', 'Engineering', 'program', 'ICE', 'year', '2'));
  select * into v_p from public.profiles where id = v_student;
  if v_p.role <> 'student' or v_p.student_id <> v_sid then
    raise exception 'CHECK FAILED 4: %', row_to_json(v_p);
  end if;

  -- 5. A guest books one hour a week.
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  insert into public.bookings (court_id, date, start_hour, end_hour)
  values (1, v_wk1, 8, 9) returning id into v_first;

  begin
    insert into public.bookings (court_id, date, start_hour, end_hour) values (1, v_wk1 + 2, 8, 9);
    raise exception 'CHECK FAILED 5a: second hour in the same week was accepted';
  exception when others then
    if sqlerrm <> 'Guests can book 1 hour a week.' then raise exception 'CHECK FAILED 5a: %', sqlerrm; end if;
  end;

  begin
    insert into public.bookings (court_id, date, start_hour, end_hour) values (1, v_wk2, 8, 10);
    raise exception 'CHECK FAILED 5b: two hours in one go were accepted';
  exception when others then
    if sqlerrm <> 'Guests can book 1 hour a week.' then raise exception 'CHECK FAILED 5b: %', sqlerrm; end if;
  end;

  -- 6. The next week has its own hour.
  insert into public.bookings (court_id, date, start_hour, end_hour) values (1, v_wk2, 8, 9);

  -- 7. Cancelling gives the hour back.
  update public.bookings set status = 'cancelled' where id = v_first;
  insert into public.bookings (court_id, date, start_hour, end_hour) values (1, v_wk1 + 1, 9, 10);

  -- 8. Students keep 2 back-to-back hours a day.
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  insert into public.bookings (court_id, date, start_hour, end_hour) values (1, v_wk1, 10, 12);

  -- 9. The demo (anonymous) can look around but not book.
  perform set_config('request.jwt.claims', json_build_object('sub', v_anon, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    insert into public.bookings (court_id, date, start_hour, end_hour) values (1, v_wk2, 10, 11);
    raise exception 'CHECK FAILED 9: the demo booked a court';
  exception when others then
    if sqlerrm <> 'The demo can look around but not book. Create a free guest account to book 1 hour a week.' then
      raise exception 'CHECK FAILED 9: %', sqlerrm;
    end if;
  end;

  -- 10. Guests cannot reserve equipment.
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  begin
    insert into public.loans (date, racket, balls) values (v_today, 1, 0);
    raise exception 'CHECK FAILED 10: a guest reserved equipment';
  exception when others then
    if sqlerrm <> 'Equipment loans are for Chula students.' then raise exception 'CHECK FAILED 10: %', sqlerrm; end if;
  end;

  -- 11. court_bookings shows a guest other members' hours but not who, the code or notes.
  select * into v_p from public.court_bookings(v_wk1, v_wk1) where start_hour = 10;
  if v_p.user_id is not null or v_p.code is not null or v_p.court_id <> 1 or v_p.end_hour <> 12 then
    raise exception 'CHECK FAILED 11a: %', row_to_json(v_p);
  end if;
  select * into v_p from public.court_bookings(v_wk2, v_wk2) where start_hour = 8;
  if v_p.user_id is distinct from v_guest or v_p.code is null then
    raise exception 'CHECK FAILED 11b: own booking is masked: %', row_to_json(v_p);
  end if;

  -- 12. Through RLS a guest reads only their own booking rows from the table.
  set local role authenticated;
  if exists (select 1 from public.bookings b where b.user_id is distinct from v_guest) then
    raise exception 'CHECK FAILED 12: a guest can read other members'' booking rows';
  end if;
  if not exists (select 1 from public.bookings b where b.user_id = v_guest) then
    raise exception 'CHECK FAILED 12b: a guest cannot read their own booking rows';
  end if;
  reset role;

  raise exception 'GUEST CHECKS PASSED (rolled back)';
end;
$$;
