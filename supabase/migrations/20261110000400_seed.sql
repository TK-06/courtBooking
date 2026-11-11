-- No people or admin email addresses belong in the seed. Populate
-- public.admin_emails manually as postgres before an admin signs up.
insert into public.courts (id, name, status, note) values
  (1, 'Court I', 'open', ''),
  (2, 'Court II', 'closed', 'Closed for resurfacing. Reopening date to follow.');

insert into public.equipment (id, name, plural, total, max_per_day) values
  ('racket', 'Racket', 'Rackets', 8, 2),
  ('balls', 'Can of balls', 'Cans of balls', 12, 2);

insert into public.closed_days (date, message) values
  ('2026-11-22', 'The courts are closed on Sun 22 Nov for a university event.');
