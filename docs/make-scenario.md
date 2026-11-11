# Make.com scenario: "ITC booking log"

Writes one row into `public.booking_events` (the supporting table) every time a booking or an equipment loan is created or changes state. The app shows these rows as each student's booking log and the admin activity log.

## How data reaches Make

1. A row is inserted or updated in `public.bookings` or `public.loans` (from the Vue app).
2. The trigger `private.notify_make()` (migration `20261110000500_make_webhook.sql`) posts the change with `pg_net` to Make's custom webhook. The body has the same shape as a Supabase Database Webhook:
   ```json
   { "type": "INSERT|UPDATE", "table": "bookings|loans", "schema": "public",
     "record": { ...new row... }, "old_record": { ...old row, UPDATE only... } }
   ```
   The webhook URL is read from `private.app_config` (key `make_webhook_url`), so it never lives in the repo.
3. Make runs the scenario instantly and writes the event row with the Supabase **service_role** connection (bypasses RLS; the key lives only in Make).

## Modules

| # | Module | Purpose |
|---|---|---|
| 1 | Webhooks › Custom webhook (`ITC booking webhook`) | Receives the change |
| 2 | Flow control › Router | One route per event type |
| 3–9 | Supabase › Create a Row, table `booking_events` | Writes the log row |

Every Create a Row maps `user_id = {{1.record.user_id}}`, `source = Make.com`, and either `booking_id` or `loan_id = {{1.record.id}}`.

## Routes (filters → kind → text)

| Route | Filter | kind | Example text |
|---|---|---|---|
| Booking created (student) | table = bookings, type = INSERT, record.purpose does not exist | booking.created | Booked Court I for Fri 13 Nov, 18:00–19:00 |
| Booking created (club) | table = bookings, type = INSERT, record.purpose exists | booking.created | Club booking on Court I for Sat 21 Nov, 08:00–11:00 |
| Cancelled by member | bookings, UPDATE, old_record.status = confirmed, record.status = cancelled, cancelled_by = member | booking.cancelled | Cancelled Court I on Fri 13 Nov, 18:00–19:00. Reason: weather |
| Cancelled by the club | same, cancelled_by = club | booking.cancelled | Cancelled by the club: Court I on Fri 13 Nov, 18:00–19:00. Reason: court maintenance. Message: "…" |
| Loan reserved | table = loans, type = INSERT | loan.reserved | Reserved 1 racket and 1 can of balls for Thu 12 Nov |
| Loan picked up | loans, UPDATE, record.status = out | loan.picked_up | Picked up 1 racket and 1 can of balls |
| Loan returned | loans, UPDATE, record.status = returned | loan.returned | Returned 1 racket and 1 can of balls |

Text formulas used: court `{{if(1.record.court_id = 1; "Court I"; "Court II")}}`, date `{{formatDate(parseDate(1.record.date; "YYYY-MM-DD"); "ddd D MMM")}}`, hour `{{if(1.record.start_hour < 10; "0"; "")}}{{1.record.start_hour}}:00`.

## Verified (11 Nov 2026)

A test student booked, cancelled and reserved equipment through the live API; the scenario ran successfully each time and wrote:

- `booking.created`: Booked Court I for Fri 13 Nov, 18:00–19:00
- `booking.cancelled`: Cancelled Court I on Fri 13 Nov, 18:00–19:00. Reason: weather
- `loan.reserved`: Reserved 1 racket and 1 can of balls for Thu 12 Nov

## Screenshot for the submission

Open the scenario in Make (Scenarios › ITC booking log), make a booking in the app, then capture the canvas with the run bubbles showing (or the History tab with the successful run) and the Supabase `booking_events` table with the new row.

## Setting it up again from scratch

1. Make: create a Custom webhook; copy its URL.
2. Supabase SQL editor (as postgres): `insert into private.app_config (key, value) values ('make_webhook_url', '<webhook URL>');`
3. Make: add a Supabase connection (Project ID + legacy `service_role` key).
4. Build the router and the seven Create a Row modules as in the table above; set scheduling to Immediately; turn the scenario on.
