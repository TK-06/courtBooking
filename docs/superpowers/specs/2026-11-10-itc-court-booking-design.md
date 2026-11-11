# ITC Courts: design spec

Date: 10 Nov 2026. Due: 16 Nov 2026 (MyCourseVille).
Visual and behavioural reference: `docs/design/prototype.html` (open it in a browser; use "Preview as student" and "Preview as admin"). Where this spec and the prototype disagree, this spec wins.

## 1. What and why

A web app for Chula engineering students to book the two tennis courts of **Intania Tennis Club (ITC)** at **CUB 13**, borrow club rackets and balls, and see their own playing history. Club admins run the courts from the same app.

It is also the ISE "Vue Web Application Integration Assignment" (`ISE_Vue_Frontend_Cloud_Database_Assignment…pdf`). The rubric:

| Area | Marks | What this app shows |
|---|---|---|
| Vue system | 60 | Booking form (4-step flow) and record lists (My bookings, admin Bookings), clear on phone and desktop |
| Supabase | 20 | Related tables (`bookings` primary, `booking_events` supporting, plus courts, profiles, loans); Vue reads and inserts |
| Make.com | 20 | One scenario: Supabase Database Webhook on `bookings`/`loans` → Make → inserts a row into `booking_events` |

Success: a student books an hour on a phone in under a minute; the professor sees a polished desktop UI; the four submission screenshots can be taken from the live app.

**Goals:** real, deployable app (GitHub Pages), mobile first, desktop as good. **Non-goals:** payments, email/push notifications, waitlists, multiple clubs, i18n (English only). **Anti-goals:** a booking can never overlap another; a club booking can never replace a student booking; nothing secret in the client or the repo.

## 2. Users and roles

- **Student** (`profiles.role = 'student'`): signs up with a `@student.chula.ac.th` email.
- **Admin** (`role = 'admin'`): any email listed in the `admin_emails` table (RLS on, no policies, filled by hand in the live database, never in the repo) becomes an admin at sign-up, whatever its domain. An admin can switch between student view and admin view. Admin profiles need no student ID.

## 3. Rules (exact values)

| Rule | Student | Admin (club booking) |
|---|---|---|
| Court hours | 08:00–22:00, 1-hour slots, starts 08..21 | same |
| Booking window | today .. today + 14 days | today .. today + 90 days |
| Hours per day | max 2 per student per date, back to back | any length, back to back |
| Past hours | not bookable (slot whose start ≤ now) | same |
| Closed court / closed day | not bookable | not bookable (reopen first) |
| Overlap | never; enforced in the database | never; a taken hour shows who holds it and links to Bookings |
| Cancel | own booking, until 2 hours before start; optional reason | any booking, any time, only from Admin › Bookings; **required** reason, **required** message (≥ 15 characters), **required** checkboxes (1 for a club booking, 2 for a student's) |
| Title | none | none; bookings made in admin view are stored with `purpose = 'Club booking'` (changed 11 Nov at the user's request) |

Loans: one day at a time; date today .. today + 6; rackets total 8, max 2 per student per day; cans of balls total 12, max 2; one active loan per student per day; status `reserved → out → returned` (admin moves it). Closed days block loans too.

Timezone: everything in **Asia/Bangkok** (UTC+7, no DST). "Today" and "now" are Bangkok time on client and server.

Booking code: `ITC-MMDD-NNNN` (MMDD of the booking date, NNNN a global sequence, zero-padded).

Court rules shown to students (exact copy):
1. **Open every day, 08:00 to 22:00** — Courts are booked by the hour. The last hour starts at 21:00.
2. **Up to 2 hours a day** — Two hours on the same day have to be back to back. You can book 14 days ahead.
3. **Please bring your own equipment** — No racket? Borrow one, and a can of balls, for the day.
4. **Tidy up after your session** — Take balls, bottles and towels with you so the court is ready for the next players.
5. **Cancel at least 2 hours before** — That gives someone else time to take the hour.
6. **Arrive on time** — Your hour ends on the hour, whenever you start.

Club facts (exact): name Intania Tennis Club; courts at CUB 13, Chulalongkorn University, Pathum Wan, Bangkok; map `https://maps.app.goo.gl/4LWxM2rodPUCLwEK8`; Instagram `https://www.instagram.com/intaniatennisclub/`; phone `061-783-0155` (`tel:+66617830155`).

## 4. Screens

Same screens, copy and states as the prototype. Student (bottom tabs on phone, sidebar ≥ 980px): **Home** (next-booking ticket with ⋯ menu: View details / Cancel booking; two court drawings, Court II grey when closed; Book a court; rows to Borrow, Club, Rules; "Also booked"), **Book** (4 steps, progress bar: 1 date calendar scrolling vertically with Open/Selected/Full/Closed legend; 2 court + hour grid; 3 review + rules + "I've read the court rules" checkbox; 4 confirmation ticket with code) — **no equipment step**, **Booking detail** (ticket, status, history from `booking_events`, cancel button or cutoff note; shows "Cancelled by the club" + reason + message when the club cancelled), **My bookings** (Upcoming/Played/Cancelled), **Borrow** (day strip, rackets and balls steppers with live availability, your loans), **Club** (logo, court status, CUB 13 location card → Maps, Instagram card, phone card with Call and Copy, rules), **Profile** (summary sentence, 12-week heat map of hours played with booked days outlined and today ringed, booking log, sign out).

Admin (tabs: Today, Bookings, Courts, Equipment, Members): **Today** (4 figures, today's schedule grid per court, latest activity, equipment today, "Book for the club"), **Bookings** (Today/Upcoming/Past/Cancelled, search by name or code, View, Cancel → strict cancel sheet), **Courts** (open/close each court with a message for students), **Equipment** (free today, loans table with Mark picked up / Mark returned), **Members** (search, member list with booking count and last activity, activity log filtered by member and kind, "Logged by" column showing Make.com or App). Admin booking flow: same 4 steps; step 2 taken hour → panel "HH:00 belongs to NAME (CODE)… Open in Bookings"; step 3 asks for the title instead of the rules checkbox.

Sign-in: Sign in / Create account tabs. Create account asks full name, 10-digit student ID, program, year, email, password (≥ 8). Errors exactly as in the prototype.

## 5. Look

Palette, type and components exactly as the prototype's `:root` tokens (light and dark): paper `#F4EDE1`, crimson `#801E2B`, camel `#B08A5E`, ink `#2A2426`. Fonts: Newsreader (display), Archivo at `font-stretch:125%` (labels, wordmark), IBM Plex Sans (body), IBM Plex Mono (codes). Logo: `docs/design/logo-full.png` and `logo-mark.png` as CSS masks (`background: currentColor`). Motion: hover lift 2px on linked cards, buttons up 1px on hover and press 1px + scale .985, one entrance on Home, `prefers-reduced-motion` disables all. Court drawings use real proportions (prototype `CourtArt`).

## 6. Data (Supabase, Postgres)

Primary table: **`bookings`**. Supporting table written by Make.com: **`booking_events`**.

```
profiles(id uuid pk → auth.users, full_name text, student_id text unique /^\d{10}$/, program text, year int 1..8,
         role text 'student'|'admin' default 'student', created_at timestamptz)
courts(id smallint pk, name text, status text 'open'|'closed', note text default '')      -- seed: 1 Court I open, 2 Court II closed
closed_days(date date pk, message text)
bookings(id uuid pk, code text unique, user_id uuid → profiles, court_id smallint → courts, date date,
         start_hour smallint 8..21, end_hour smallint start+1..22, status text 'confirmed'|'cancelled',
         purpose text null (≤60, admin only), cancel_reason text, cancel_note text,
         cancelled_by text 'member'|'club' null, cancelled_at timestamptz, created_at timestamptz)
         EXCLUDE USING gist (court_id WITH =, date WITH =, int4range(start_hour,end_hour) WITH &&) WHERE (status='confirmed')
equipment(id text pk 'racket'|'balls', name text, plural text, total int, max_per_day int)   -- 8/2 and 12/2
loans(id uuid pk, user_id uuid → profiles, date date, racket int 0..2, balls int 0..2, status 'reserved'|'out'|'returned', created_at)
booking_events(id bigint identity pk, booking_id uuid null → bookings, loan_id uuid null → loans, user_id uuid → profiles,
         kind text 'booking.created'|'booking.cancelled'|'loan.reserved'|'loan.picked_up'|'loan.returned'|'court.closed'|'court.opened',
         text text, source text 'Make.com'|'App' default 'Make.com', created_at timestamptz)
```

Rules live in the database (triggers), mirrored in a pure JS module for instant UI feedback:
- `bookings` BEFORE INSERT: sets `code`, `user_id = auth.uid()`, checks every rule in §3 for the caller's role; raises with a human message (e.g. `You can book up to 14 days ahead.`).
- `bookings` BEFORE UPDATE: only `status → cancelled` and the cancel columns may change; student: own + cutoff; admin: reason + note ≥ 15.
- `loans` BEFORE INSERT/UPDATE: availability, max per day, one per day, window; only admin changes status.
- `court.closed/opened` events are written by the app (source `App`) when an admin saves a court.
- `equipment_available(p_date date)` SECURITY DEFINER returns `(id, total, free)` so students see counts without seeing others' loans.
- New `auth.users` row → trigger creates `profiles` from `raw_user_meta_data`; rejects emails not ending `@student.chula.ac.th` (admins are promoted later by SQL).

RLS: everything requires an authenticated user. Read all: courts, closed_days, equipment, bookings (needed for availability). Read own or admin: profiles (others' names only for admin), loans, booking_events. Insert: bookings and loans for self; booking_events only by the service role (Make.com) or by admin with `source='App'` and kind `court.*`. Update: bookings own/admin (trigger narrows columns), loans admin, courts/closed_days admin.

## 7. Make.com scenario

"ITC booking log": **Custom webhook** ← two Supabase Database Webhooks (`bookings` INSERT/UPDATE, `loans` INSERT/UPDATE) → **Router**:
- `bookings` INSERT → Supabase *Create a Row* in `booking_events`: kind `booking.created`, text `Booked Court I for Thu 12 Nov, 18:00–19:00` (club: `Club booking on Court I for Sat 21 Nov, 08:00–11:00: Club training`).
- `bookings` UPDATE where `old.status='confirmed'` and `record.status='cancelled'` → `booking.cancelled`, text `Cancelled Court I on Thu 12 Nov, 18:00–19:00. Reason: weather` (club: prefix `Cancelled by the club:` and append `. Message: "<note>"`).
- `loans` INSERT → `loan.reserved` (`Reserved 1 racket and 1 can of balls for Wed 11 Nov`); UPDATE to `out` → `loan.picked_up`; to `returned` → `loan.returned`.
Make connects with the service-role key stored only in Make. The app subscribes to `booking_events` inserts (Supabase Realtime) so the log updates live. If Make is off, bookings still work; only the log is missing rows.

## 8. Delivery

- Vue 3 + Vite, Vue Router with **hash history** (GitHub Pages has no SPA fallback), `@supabase/supabase-js` v2, Vitest. No UI framework, no Pinia.
- Repo ready for GitHub: `.gitignore` (node_modules, dist, .env*, keep `.env.example`), `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE`; README with setup, Supabase migration order, Make setup, deploy.
- `.github/workflows/deploy.yml`: on push to `main`, `npm ci && npm test && npm run build` with repo secrets, deploy `dist` to GitHub Pages. The user pushes and turns Pages on; no git commands are run for them.
- Submission: ZIP of source + screenshots of form, list, both tables with rows, Make scenario run (README lists them).

## 9. Left to the builder

Component split, CSS file layout, test tooling details, empty/loading/error states not in the prototype (match its voice: short, plain, no "please"/"successfully"), and how the JS rule module is shared between views.

## 10. Calls I made (check these)

1. Rules enforced by DB triggers + direct `insert` from Vue (matches the rubric's "Vue inserts primary-table rows"), not RPC functions.
2. Students can read all bookings rows (court occupancy) but not other students' names.
3. Admin bookings still respect closed courts/days.
4. Email confirmation: turn **off** in Supabase Auth for the demo (otherwise every test account needs an inbox).
5. The seed migration holds only courts, equipment and one closed day. People and bookings come from real sign-ups (make 3–4 test accounts for the screenshots), since fake `auth.users` rows don't belong in a live project.
6. Create-account `program` is a select: ICE, ADME, AERO, NANO, ChPE, Other.
