# ITC Courts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Intania Tennis Club court booking app (Vue 3 + Supabase + Make.com) described in the spec, matching the prototype, deployable to GitHub Pages.

**Architecture:** A Vite-built Vue 3 SPA with hash routing talks straight to Supabase (`supabase-js`): it reads tables and inserts `bookings`/`loans` rows. Every booking rule lives twice: in Postgres triggers (the authority) and in a pure JS module `src/lib/rules.js` (instant UI feedback, unit-tested). Make.com receives Supabase Database Webhooks and writes `booking_events`; the app shows them via Realtime.

**Tech Stack:** Node 20+, Vue 3.4, Vue Router 4 (hash history), @supabase/supabase-js 2, Vite 5, Vitest 2 + @vue/test-utils + jsdom, Postgres (Supabase) with btree_gist, Make.com, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-10-itc-court-booking-design.md` · **Visual reference:** `docs/design/prototype.html` (copy its CSS tokens, markup and copy; port its components to SFCs).

## Global Constraints

- Every rule value, screen, message and copy string comes from the spec §3–§5 and the prototype; do not invent copy. No "please" (except the rule "Please bring your own equipment"), no "successfully", no exclamation marks.
- **Do not run any git command that changes state.** Where a step says *Checkpoint*, stop and tell the user the task is ready to commit.
- Never commit or print secrets. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable) reach the client. The service-role key lives only in Make.com.
- Timezone Asia/Bangkok (UTC+7, no DST) for "today", "now", past slots and display, regardless of the device clock.
- Mobile first; at 320px nothing scrolls sideways; every tap target ≥ 44px; `prefers-reduced-motion` disables animation; light and dark themes via the prototype's tokens.
- Shared domain shapes (JS, camelCase), produced by `src/lib/api.js` and consumed everywhere:
  - `Booking = {id, code, userId, courtId, date:'YYYY-MM-DD', start:int, end:int, status:'confirmed'|'cancelled', purpose:string|null, cancelReason, cancelNote, cancelledBy:'member'|'club'|null, createdAt:Date}`
  - `Court = {id:1|2, name, status:'open'|'closed', note}` · `ClosedDays = {[iso]: message}`
  - `Loan = {id, userId, date, racket, balls, status:'reserved'|'out'|'returned', createdAt:Date}`
  - `Event = {id, bookingId, loanId, userId, kind, text, source:'Make.com'|'App', createdAt:Date}`
  - `Profile = {id, fullName, studentId, program, year, role:'student'|'admin'}`
- Messages: one table, `MESSAGES` in `src/lib/rules.js`; the SQL triggers raise the **same strings**:

| key | text |
|---|---|
| past | That hour has already started. |
| windowStudent | You can book up to 14 days ahead. |
| windowAdmin | Club bookings can go up to 90 days ahead. |
| maxHours | You can book up to 2 hours a day. |
| adjacent | Hours on the same day have to be back to back. |
| courtClosed | That court is closed. |
| dayClosed | The courts are closed that day. |
| taken | Someone just took one of those hours. Pick again. |
| cutoff | Cancelling closed 2 hours before the start time. |
| purpose | Add a short title, such as Club training or Inter-faculty match. |
| reason | Pick a reason. |
| noteMember | Write at least a sentence so {first} knows why. |
| noteClub | Write at least a sentence for the log. |
| ackBoth / ackOne | Tick both boxes to confirm. / Tick the box to confirm. |
| email | Use your Chula student email, the one ending in @student.chula.ac.th. |
| loanNone | Choose a racket or a can of balls first. |
| loanMax | Up to 2 {plural} a day. |
| loanFree | Only {n} free that day. |
| loanDup | You already have equipment reserved for {date}. |

## Review Focus

1. **Device clock not in Bangkok** (a laptop on UTC at 18:30Z is already tomorrow 01:30 in Bangkok): today, past slots and the heat map must follow Bangkok. Test: Task 2 `bangkokParts`.
2. **Two students take the same hour at once:** the second insert fails on the exclusion constraint (SQLSTATE 23P01); the UI shows `MESSAGES.taken` and returns to step 2. Tests: Task 5 overlap check, Task 6 `toMessage`.
3. **Cancel exactly at the cutoff:** at start − 2h:00 a student can still cancel; at start − 1h:59 they cannot; admins can always. Tests: Task 3 `canCancel`, Task 5 cutoff check.
4. **The 21:00 slot:** a 2-hour selection can't run past 22:00; `end_hour ≤ 22`. Tests: Task 3 `toggleSlot`, Task 5 check constraint.
5. **Email typed with capitals or spaces** (` 6638012321@Student.Chula.ac.th `) is accepted after trim + lowercase, on client and in the signup trigger. Tests: Task 3 `isChulaEmail`, Task 5 signup check.

## File map

```
.github/workflows/deploy.yml        T14   build, test, deploy dist to Pages
.env.example  .gitignore  README.md T1/T14
index.html  vite.config.js  package.json   T1
public/logo-full.png  public/logo-mark.png T1 (from docs/design)
src/main.js  src/App.vue  src/router.js    T1/T7
src/styles/tokens.css  base.css            T1   prototype :root tokens + base rules
src/lib/time.js  format.js                 T2   Bangkok time, display formats
src/lib/rules.js                           T3   pure booking/loan rules + MESSAGES
src/lib/supabase.js  api.js                T6   client, row mapping, data calls, realtime
src/composables/useAuth.js useToast.js     T7
src/components/  Icon ClubLogo CourtArt RacketArt BallsArt AppShell Toast TicketCard CancelSheet AdminCancelSheet HeatMap
src/views/  SignIn Home BookFlow (+ steps/StepDate StepSlots StepReview StepDone) BookingDetail MyBookings Borrow Club Profile
src/views/admin/  AdminToday AdminBookings AdminCourts AdminEquipment AdminMembers
supabase/migrations/  20261110000100_schema.sql  …0200_rules.sql  …0300_rls.sql  …0400_seed.sql   T4/T5
supabase/tests/rules_check.sql             T5   transactional SQL checks, rolled back
docs/make-scenario.md                      T13
tests/unit/*.test.js                       per task
```

---

### Task 1: Project scaffold, tokens, assets

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/App.vue`, `src/styles/tokens.css`, `src/styles/base.css`, `public/logo-full.png`, `public/logo-mark.png`, `.gitignore`, `.env.example`, `README.md` (stub), `tests/unit/smoke.test.js`

**Interfaces:**
- Produces: CSS custom properties from the prototype `:root` (incl. `--logo-full: url(logo-full.png)` relative to `import.meta.env.BASE_URL` via `src/main.js` setting it on `document.documentElement`), `npm test` = `vitest run`, `npm run build`.

- [ ] **Step 1: Write the failing test** `tests/unit/smoke.test.js`
```js
import { mount } from '@vue/test-utils'
import App from '../../src/App.vue'
test('app mounts with a router view', () => {
  const w = mount(App, { global: { stubs: ['router-view'] } })
  expect(w.html()).toContain('router-view')
})
```
- [ ] **Step 2:** `npm test` → FAIL (no project).
- [ ] **Step 3: Scaffold.** Dependencies: `vue@^3.4`, `vue-router@^4.4`, `@supabase/supabase-js@^2.45`; dev: `vite@^5.4`, `@vitejs/plugin-vue@^5.1`, `vitest@^2.1`, `@vue/test-utils@^2.4`, `jsdom@^25`. `vite.config.js`: `base: process.env.VITE_BASE || '/'`, `test: { environment: 'jsdom', globals: true }`. `index.html` loads the prototype's Google Fonts link and sets `<title>Intania Tennis Club Courts</title>` and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Copy `docs/design/logo-*.png` to `public/`. Port the prototype `<style>` into `tokens.css` (tokens, light + dark) and `base.css` (element resets, `.btn`, `.chip`, `.card`, `.seg`, `.field`, `.label`, `.display`, motion keyframes, reduced motion). `.gitignore`: `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example`, `.DS_Store`, `.taste-skill`. `.env.example`: the three `VITE_*` keys, empty.
- [ ] **Step 4:** `npm install && npm test` → PASS; `npm run build` → exit 0.
- [ ] **Step 5: Checkpoint** (user commits "chore: scaffold vue app").

### Task 2: Bangkok time and formatting

**Files:** Create `src/lib/time.js`, `src/lib/format.js`, `tests/unit/time.test.js`, `tests/unit/format.test.js`

**Interfaces:**
- Produces (`time.js`): `bangkokParts(now: Date) -> {iso: string, hour: number, minute: number}`; `todayIso(now: Date) -> string`; `addDays(iso, n) -> iso`; `weekdayIndex(iso) -> 0..6` (Sun=0); `slotInstant(iso, hour) -> Date` (the absolute instant of that Bangkok wall time); `mondayOf(iso) -> iso`.
- Produces (`format.js`): `hh(h) -> '08:00'`; `range(b) -> '18:00–19:00'`; `fmtDate(iso) -> 'Thu 12 Nov'`; `fmtLong(iso) -> 'Thursday 12 November'`; `hoursText(n) -> '1 hour'|'n hours'`; `itemsText(loan) -> '1 racket and 2 cans of balls'`; `fmtStamp(date, now) -> 'Today, 13:21'|'Yesterday, 21:04'|'9 Nov, 21:04'` (Bangkok); `fmtRel(date, now) -> 'Just now'|'5 min ago'|'3 h ago'|'Yesterday'|'4 days ago'`.

- [ ] **Step 1: Write failing tests**
```js
test('device clock in UTC still yields Bangkok date', () => {
  expect(bangkokParts(new Date('2026-11-10T18:30:00Z'))).toEqual({ iso: '2026-11-11', hour: 1, minute: 30 })
})
test('slotInstant is UTC minus 7', () => {
  expect(slotInstant('2026-11-12', 18).toISOString()).toBe('2026-11-12T11:00:00.000Z')
})
test('addDays crosses months', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'))
test('mondayOf', () => expect(mondayOf('2026-11-10')).toBe('2026-11-09'))
test('formats', () => {
  expect(fmtDate('2026-11-12')).toBe('Thu 12 Nov')
  expect(fmtLong('2026-11-12')).toBe('Thursday 12 November')
  expect(range({ start: 18, end: 20 })).toBe('18:00–20:00')
  expect(itemsText({ racket: 1, balls: 2 })).toBe('1 racket and 2 cans of balls')
  const now = new Date('2026-11-10T06:20:00Z') // 13:20 Bangkok
  expect(fmtStamp(new Date('2026-11-10T06:21:00Z'), now)).toBe('Today, 13:21')
  expect(fmtStamp(new Date('2026-11-09T14:04:00Z'), now)).toBe('Yesterday, 21:04')
})
```
- [ ] **Step 2:** `npx vitest run tests/unit/time.test.js tests/unit/format.test.js` → FAIL.
- [ ] **Step 3: Implement** with fixed +7h offset arithmetic on UTC getters (no `Intl` time-zone dependency, no libraries).
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5: Checkpoint.**

### Task 3: Booking and loan rules (pure)

**Files:** Create `src/lib/rules.js`, `tests/unit/rules.test.js`

**Interfaces:**
- Consumes: Task 2.
- Produces: constants `HOURS=[8..21]`, `CLOSE_HOUR=22`, `STUDENT_WINDOW_DAYS=14`, `ADMIN_WINDOW_DAYS=90`, `STUDENT_MAX_HOURS=2`, `CANCEL_CUTOFF_HOURS=2`, `LOAN_AHEAD_DAYS=6`, `HEAT_WEEKS=12`, `MESSAGES` (table above, `{first}` etc. filled by `msg(key, vars)`); and
  - `windowEnd(todayIso, role) -> iso`
  - `isFree({date, courtId, hour, now, courts, closedDays, bookings}) -> boolean`
  - `slotState({date, courtId, hour, now, courts, closedDays, bookings, userId, selected}) -> 'open'|'selected'|'booked'|'mine'|'past'|'closed'`
  - `dayStatus({date, now, role, courts, closedDays, bookings}) -> 'past'|'out'|'closed'|'full'|'open'`
  - `toggleSlot({slots, hour, state, role, hoursUsed}) -> {slots: number[], message: string|null, blocked: boolean}`
  - `statusOf(booking, now) -> 'upcoming'|'live'|'played'|'cancelled'`; `canCancel(booking, now) -> boolean`
  - `validateAdminCancel({reason, note, ack1, ack2, memberFirst|null}) -> {reason?, note?, ack?}`
  - `isChulaEmail(raw) -> boolean`; `validateSignUp({fullName, studentId, email, password, mode}) -> string|null`
  - `validateLoan({racket, balls, equipment, free, hasLoanThatDay, date}) -> string|null`
  - `buildHeatMap({bookings, userId, now, weeks}) -> [{key, month, days:[{iso, cls, title}]}]` (cls: `h1`, `h2`, `up`, `fut`, plus ` today`), same output as prototype `heat`.

- [ ] **Step 1: Write failing tests** (`now = new Date('2026-11-10T06:20:00Z')`, i.e. Tue 10 Nov 13:20 Bangkok; courts `[{id:1,status:'open'},{id:2,status:'closed'}]`)
```js
test('window', () => {
  expect(windowEnd('2026-11-10', 'student')).toBe('2026-11-24')
  expect(windowEnd('2026-11-10', 'admin')).toBe('2027-02-08')
})
test('13:00 slot today is past at 13:20', () => expect(slotState({ date:'2026-11-10', courtId:1, hour:13, now, courts, closedDays:{}, bookings:[], userId:'u1', selected:[] })).toBe('past'))
test('closed court', () => expect(slotState({ date:'2026-11-12', courtId:2, hour:18, now, courts, closedDays:{}, bookings:[], userId:'u1', selected:[] })).toBe('closed'))
test('mine vs booked', () => {
  const bookings = [{ courtId:1, date:'2026-11-12', start:18, end:20, status:'confirmed', userId:'u1' }]
  expect(slotState({ date:'2026-11-12', courtId:1, hour:19, now, courts, closedDays:{}, bookings, userId:'u1', selected:[] })).toBe('mine')
  expect(slotState({ date:'2026-11-12', courtId:1, hour:19, now, courts, closedDays:{}, bookings, userId:'u2', selected:[] })).toBe('booked')
})
test('day status', () => {
  expect(dayStatus({ date:'2026-11-25', now, role:'student', courts, closedDays:{}, bookings:[] })).toBe('out')
  expect(dayStatus({ date:'2026-11-25', now, role:'admin', courts, closedDays:{}, bookings:[] })).toBe('open')
  expect(dayStatus({ date:'2026-11-22', now, role:'student', courts, closedDays:{'2026-11-22':'x'}, bookings:[] })).toBe('closed')
})
test('student cap and adjacency', () => {
  expect(toggleSlot({ slots:[18], hour:19, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([18,19])
  expect(toggleSlot({ slots:[18,19], hour:20, state:'open', role:'student', hoursUsed:0 }).message).toBe('You can book up to 2 hours a day.')
  expect(toggleSlot({ slots:[18], hour:20, state:'open', role:'student', hoursUsed:1 }).message).toBe('You can book up to 2 hours a day.')
  expect(toggleSlot({ slots:[18], hour:15, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([15])
})
test('admin any length, never over a booking', () => {
  expect(toggleSlot({ slots:[8,9,10], hour:11, state:'open', role:'admin', hoursUsed:0 }).slots).toEqual([8,9,10,11])
  expect(toggleSlot({ slots:[8], hour:9, state:'booked', role:'admin', hoursUsed:0 })).toEqual({ slots:[8], message:null, blocked:true })
  expect(toggleSlot({ slots:[8,9,10], hour:9, state:'selected', role:'admin', hoursUsed:0 }).slots).toEqual([9])
})
test('21:00 is the last start', () => expect(HOURS.at(-1)).toBe(21))
test('cancel cutoff boundary', () => {
  const b = { date:'2026-11-10', start:16, end:17, status:'confirmed' } // 16:00 Bangkok = 09:00Z
  expect(canCancel(b, new Date('2026-11-10T07:00:00Z'))).toBe(true)   // exactly 2h before
  expect(canCancel(b, new Date('2026-11-10T07:01:00Z'))).toBe(false)
})
test('admin cancel validation', () => {
  expect(validateAdminCancel({ reason:null, note:'short', ack1:false, ack2:false, memberFirst:'Napat' }))
    .toEqual({ reason:'Pick a reason.', note:'Write at least a sentence so Napat knows why.', ack:'Tick both boxes to confirm.' })
  expect(validateAdminCancel({ reason:'Weather', note:'Rain all evening, court is flooded.', ack1:true, ack2:false, memberFirst:null })).toEqual({})
})
test('chula email', () => {
  expect(isChulaEmail(' 6638012321@Student.Chula.ac.th ')).toBe(true)
  expect(isChulaEmail('me@gmail.com')).toBe(false)
})
test('heat map shape', () => {
  const cols = buildHeatMap({ bookings:[{ userId:'u1', date:'2026-11-05', start:18, end:20, status:'confirmed' }], userId:'u1', now, weeks:12 })
  expect(cols).toHaveLength(12)
  expect(cols.flatMap(c => c.days).find(d => d.iso === '2026-11-05').cls).toBe('h2')
  expect(cols.flatMap(c => c.days).find(d => d.iso === '2026-11-10').cls).toContain('today')
})
```
- [ ] **Step 2:** `npx vitest run tests/unit/rules.test.js` → FAIL.
- [ ] **Step 3: Implement** by porting the prototype's `isFree`, `slotState`, `dayStatus`, `toggleSlot` (both branches), `statusOf`, `canCancel`, `heat` and the admin `doCancel` checks into pure functions taking explicit inputs (no `this`). `toggleSlot` for students: `cap = 2 − hoursUsed`; cap ≤ 0 or full selection → `maxHours`; adjacent → add; otherwise replace. Admin: booked/mine → `{blocked:true}`; selected end → remove; selected middle → `[hour]`; adjacent to either end → extend; else replace.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Checkpoint.**

### Task 4: Database schema and seed

**Files:** Create `supabase/migrations/20261110000100_schema.sql`, `supabase/migrations/20261110000400_seed.sql`

**Interfaces:**
- Produces: tables, columns and checks exactly as spec §6 (snake_case), `create extension if not exists btree_gist`, sequence `booking_code_seq`, the exclusion constraint `bookings_no_overlap`, indexes on `bookings(date)`, `bookings(user_id)`, `loans(date)`, `booking_events(user_id, created_at desc)`. `booking_events` added to the `supabase_realtime` publication. Seed: courts `(1,'Court I','open','')`, `(2,'Court II','closed','Closed for resurfacing. Reopening date to follow.')`; equipment `('racket','Racket','Rackets',8,2)`, `('balls','Can of balls','Cans of balls',12,2)`; closed day `('2026-11-22','The courts are closed on Sun 22 Nov for a university event.')`.

- [ ] **Step 1:** In the Supabase SQL editor (or `supabase db push`) run the schema migration, then the seed.
- [ ] **Step 2: Verify:** `select id, name, status from courts order by id;` → 2 rows, Court II `closed`; `select count(*) from equipment;` → 2; inserting two overlapping confirmed rows for the same court and date fails with SQLSTATE `23P01`.
- [ ] **Step 3: Checkpoint.**

### Task 5: Triggers, RLS, functions and SQL checks

**Files:** Create `supabase/migrations/20261110000200_rules.sql`, `supabase/migrations/20261110000300_rls.sql`, `supabase/tests/rules_check.sql`

**Interfaces:**
- Consumes: Task 4 tables; `MESSAGES` strings (Global Constraints).
- Produces: `handle_new_user()` trigger on `auth.users` (lowercases + trims email, rejects non-Chula with `MESSAGES.email`, inserts `profiles` from `raw_user_meta_data` keys `full_name`, `student_id`, `program`, `year`); `is_admin() -> boolean` (security definer); `bangkok_now() -> timestamp` (`now() at time zone 'Asia/Bangkok'`); `bookings_before_insert` / `bookings_before_update`; `loans_before_write`; `equipment_available(p_date date) returns table(id text, total int, free int)`; RLS policies exactly as spec §6.

- [ ] **Step 1: Write the failing check script** `supabase/tests/rules_check.sql`: one `begin; … rollback;` transaction that inserts two students and one admin into `auth.users` (emails `t1@student.chula.ac.th`, `t2@…`, `a1@…`), promotes the admin, then for each case switches identity with `set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'role','authenticated')::text, true);` and asserts with a helper `expect_error(sql text, msg text)` / `expect_ok(sql text)` that raises `CHECK FAILED: <name>` on mismatch. Cases (dates relative to `bangkok_now()::date`):
  1. student books tomorrow 18–20 → ok, code matches `^ITC-\d{4}-\d{4}$`
  2. same student tomorrow 20–21 → `You can book up to 2 hours a day.`
  3. other student tomorrow 19–20 → `Someone just took one of those hours. Pick again.` (map 23P01 in trigger or let constraint fire; the script accepts either message or SQLSTATE 23P01)
  4. student at today + 15 → `You can book up to 14 days ahead.`; admin at today + 60 with purpose → ok; admin at today + 91 → `Club bookings can go up to 90 days ahead.`
  5. student with `purpose` set → rejected; court 2 → `That court is closed.`; closed day → `The courts are closed that day.`; end_hour 23 → check violation
  6. student cancels own booking starting in 1 hour → `Cancelling closed 2 hours before the start time.`; student updates another's booking → 0 rows changed
  7. admin cancel with note `short` → `Write at least a sentence so … knows why.`-style note error (trigger only checks length ≥ 15 and reason not null)
  8. signup `X@gmail.com` → `Use your Chula student email…`; signup ` T3@Student.Chula.ac.th ` → ok
  9. loan 3 rackets → `Up to 2 rackets a day.`; second loan same day → `You already have equipment reserved for …`; student sets loan status → rejected
  10. `equipment_available(current_date)` returns 2 rows with `free ≤ total`.
- [ ] **Step 2:** Run the script → fails (functions missing).
- [ ] **Step 3: Implement** the two migrations. Triggers mirror Task 3 rules using `bangkok_now()`; raise with `raise exception using message = '<MESSAGES text>'`. Update trigger allows only `status`, `cancel_reason`, `cancel_note`, `cancelled_by`, `cancelled_at` to change, sets `cancelled_by` (`club` if `is_admin()` and not own booking, else `member`) and `cancelled_at`.
- [ ] **Step 4:** Run the script → ends with `NOTICE: all rules checks passed` and rolls back.
- [ ] **Step 5: Checkpoint.**

### Task 6: Supabase client and data API

**Files:** Create `src/lib/supabase.js`, `src/lib/api.js`, `tests/unit/api.test.js`

**Interfaces:**
- Consumes: Task 4–5 schema.
- Produces: `supabase` client; mappers `toBooking(row)`, `toLoan(row)`, `toEvent(row)`, `toProfile(row)`; `toMessage(error) -> string` (23P01 → `MESSAGES.taken`; `P0001`/raise → `error.message`; else `Something went wrong. Try again.`); async functions returning domain shapes or throwing `Error(toMessage(e))`:
  `fetchCourts()`, `fetchClosedDays() -> ClosedDays`, `fetchEquipment()`, `fetchBookings({from, to})`, `fetchMyBookings(userId)`, `createBooking({courtId, date, start, end, purpose})`, `cancelBooking(id, {reason, note})`, `fetchLoans({userId?, date?})`, `fetchAvailability(date) -> {racket:number, balls:number}`, `createLoan({date, racket, balls})`, `setLoanStatus(id, status)`, `updateCourt(id, {status, note})` (also inserts the `court.*` event with source `App`), `fetchEvents({userId?, bookingId?, limit})`, `fetchProfiles()`, `subscribeEvents(onInsert) -> unsubscribe`.

- [ ] **Step 1: Failing tests** with `vi.mock('../../src/lib/supabase.js')` returning a chainable fake:
```js
test('createBooking inserts snake_case row', async () => { await createBooking({ courtId:1, date:'2026-11-12', start:18, end:19, purpose:null }); expect(lastInsert).toEqual({ court_id:1, date:'2026-11-12', start_hour:18, end_hour:19, purpose:null }) })
test('overlap maps to taken', () => expect(toMessage({ code:'23P01', message:'conflicting key value' })).toBe('Someone just took one of those hours. Pick again.'))
test('toBooking', () => expect(toBooking({ id:'x', code:'ITC-1112-0001', user_id:'u', court_id:1, date:'2026-11-12', start_hour:18, end_hour:19, status:'confirmed', purpose:null, cancel_reason:null, cancel_note:null, cancelled_by:null, created_at:'2026-11-09T14:04:00Z' }).createdAt).toBeInstanceOf(Date))
```
- [ ] **Step 2:** FAIL. **Step 3:** implement (`createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`; realtime via `supabase.channel('events').on('postgres_changes', {event:'INSERT', schema:'public', table:'booking_events'}, …)`). **Step 4:** PASS. **Step 5: Checkpoint.**

### Task 7: Auth, router, app shell, shared components, sign-in

**Files:** Create `src/composables/useAuth.js`, `src/composables/useToast.js`, `src/router.js`, `src/components/{Icon,ClubLogo,CourtArt,RacketArt,BallsArt,AppShell,Toast}.vue`, `src/views/SignIn.vue`; modify `src/App.vue`, `src/main.js`; test `tests/unit/router.test.js`, `tests/unit/courtart.test.js`

**Interfaces:**
- Produces: `useAuth() -> {session, profile, isAdmin, mode ('student'|'admin'), setMode(m), ready: Promise, signIn(email, pw), signUp({fullName, studentId, program, year, email, password}), signOut()}` (singleton refs); `useToast() -> {message, show(text)}` (2.8 s); `guard(to, {session, profile}) -> true | {name}`; routes (hash history, names = prototype hashes): `signin`, `home`, `book`, `booking/:id`, `bookings`, `borrow`, `club`, `profile`, `admin-today`, `admin-bookings`, `admin-courts`, `admin-equipment`, `admin-members`; meta `{auth:true}` / `{admin:true}`. Components port the prototype's `Icon` (same path set), `ClubLogo({variant:'full'|'mark', size})`, `CourtArt({closed, label})`, `RacketArt`, `BallsArt`; `AppShell` renders sidebar ≥ 980px, top bar + 5-tab bar below, nav items per `mode` exactly as the prototype.

- [ ] **Step 1: Failing tests:** `guard({meta:{auth:true}}, {session:null})` → `{name:'signin'}`; `guard({meta:{admin:true}}, {session:{}, profile:{role:'student'}})` → `{name:'home'}`; `guard({name:'signin'}, {session:{}, profile:{role:'student'}})` → `{name:'home'}`; `mount(CourtArt,{props:{closed:true,label:'Court II'}})` contains text `CLOSED` and `aria-label="Court II, closed"`.
- [ ] **Step 2:** FAIL. **Step 3:** implement; SignIn copies the prototype form (tabs, fields, `validateSignUp`, error line, program select from spec §10.6), `signUp` passes metadata to `supabase.auth.signUp({ options:{ data } })`. No prototype shortcut buttons. **Step 4:** PASS; `npm run dev`, sign up a test account, land on Home. **Step 5: Checkpoint.**

### Task 8: Booking flow (student and admin)

**Files:** Create `src/views/BookFlow.vue`, `src/views/steps/{StepDate,StepSlots,StepReview,StepDone}.vue`; test `tests/unit/bookflow.test.js`

**Interfaces:**
- Consumes: rules (T3), api `fetchCourts/fetchClosedDays/fetchBookings/createBooking` (T6), `useAuth().mode` (T7).
- Produces: route `book` with optional query `?court=1`; flow state `{step, date, courtId, slots, agree, purpose}`; after success navigates to step 4 showing the new `Booking.code`.

- [ ] **Step 1: Failing tests** (mount `StepSlots` with props `{slots: list, role, …}`): in admin role clicking a `booked` slot renders text `belongs to` and a button `Open in Bookings`; in student role the hint reads `Up to 2 hours a day, back to back`; `StepReview` in admin role renders `#purpose` and no `#agree`, in student role the six rule titles and `#agree`.
- [ ] **Step 2:** FAIL. **Step 3:** port prototype step markup and copy; on confirm call `createBooking`; on error show the message as a toast and, if it equals `MESSAGES.taken`, refetch bookings and go to step 2. Step 1 months = `windowEnd` month span, minimum 2. **No equipment section.** **Step 4:** PASS; manual: book 2 hours as student, try a third (blocked with message), book as admin with title. **Step 5: Checkpoint.**

### Task 9: Home, My bookings, Booking detail, student cancel

**Files:** Create `src/views/{Home,MyBookings,BookingDetail}.vue`, `src/components/{TicketCard,CancelSheet}.vue`; test `tests/unit/cancelsheet.test.js`

**Interfaces:**
- Consumes: api `fetchMyBookings`, `fetchCourts`, `fetchBookings({from:today,to:today})` (open hours today), `fetchEvents({bookingId})`, `cancelBooking`; rules `statusOf`, `canCancel`.
- Produces: `CancelSheet({booking})` emits `confirm({reason|null})` and `close`; `TicketCard({booking, label, menu:boolean})` emits `open`, `cancel`.

- [ ] **Step 1: Failing test:** CancelSheet with reason chip `Weather` clicked then `Cancel booking` emits `confirm` with `{ reason:'Weather' }`; `Keep booking` emits `close`.
- [ ] **Step 2:** FAIL. **Step 3:** port prototype screens (home ticket with ⋯ menu, court tiles → `book?court=id` or closed toast, rows, "Also booked"; My bookings tabs Upcoming/Played/Cancelled with counts; detail with history timeline, cutoff note, club-cancel reason and message, admin mode shows "Open in Bookings" instead of a cancel button). **Step 4:** PASS; manual: cancel a booking > 2 h ahead; confirm the hour is free in the flow. **Step 5: Checkpoint.**

### Task 10: Borrow, Club, Profile with heat map

**Files:** Create `src/views/{Borrow,Club,Profile}.vue`, `src/components/HeatMap.vue`; test `tests/unit/heatmap.test.js`

**Interfaces:**
- Consumes: api `fetchAvailability`, `fetchLoans({userId})`, `createLoan`, `fetchEvents({userId})`, `fetchMyBookings`; rules `validateLoan`, `buildHeatMap`.
- Produces: `HeatMap({columns})` renders 7 × 12 `.hc` cells plus the legend.

- [ ] **Step 1: Failing test:** HeatMap with `buildHeatMap` output for one 2-hour game renders 84 grid cells, exactly one `.h2`, one `.today`.
- [ ] **Step 2:** FAIL. **Step 3:** port prototype screens; Profile summary sentence exactly `<em>N hours</em> on court across G games since D Month. You book HH:00 most often[, and you have cancelled once|N times].`; Club uses spec §3 club facts, Copy button uses `navigator.clipboard` with toast fallback `Copy the number: 061-783-0155`. **Step 4:** PASS. **Step 5: Checkpoint.**

### Task 11: Admin views and strict cancel

**Files:** Create `src/views/admin/{AdminToday,AdminBookings,AdminCourts,AdminEquipment,AdminMembers}.vue`, `src/components/AdminCancelSheet.vue`; test `tests/unit/admincancel.test.js`

**Interfaces:**
- Consumes: api `fetchBookings`, `fetchProfiles`, `fetchEvents`, `fetchLoans`, `setLoanStatus`, `updateCourt`, `cancelBooking`, `subscribeEvents`; rules `validateAdminCancel`.
- Produces: `AdminCancelSheet({booking, memberFirst|null})` emits `confirm({reason, note})` only when `validateAdminCancel` returns `{}`; AdminBookings reads `?q=<code>&tab=upcoming` (used by "Open in Bookings").

- [ ] **Step 1: Failing test:** clicking `Cancel booking` on an empty AdminCancelSheet shows the three error lines from the Task 3 test and emits nothing; after choosing a reason, typing a 40-character note and ticking `#ack-1` and `#ack-2` it emits `confirm`.
- [ ] **Step 2:** FAIL. **Step 3:** port prototype admin screens (Today figures and schedule grid with `ITC` label for club bookings, Bookings table + search + tabs, Courts open/close with message and `upcoming bookings` count, Equipment table with Mark picked up / Mark returned, Members list + log table with "Logged by" chip; live log via `subscribeEvents`). **Step 4:** PASS; manual: cancel a student booking as admin, then sign in as that student and see "Cancelled by the club" with the message. **Step 5: Checkpoint.**

### Task 12: Loading, empty and error states pass

**Files:** Modify views from Tasks 8–11; test `tests/unit/states.test.js`

**Interfaces:** Consumes everything above.

- [ ] **Step 1: Failing test:** Home with `fetchMyBookings` rejected (mock) shows `Couldn't load your bookings. Check your connection and try again.` and a `Try again` button that refetches.
- [ ] **Step 2:** FAIL. **Step 3:** every view: a skeleton or "Loading…" line while fetching, the prototype's empty copy when empty, the message above + `Try again` on failure. **Step 4:** `npm test` all PASS; at 320px width no screen scrolls sideways (check in devtools for each route). **Step 5: Checkpoint.**

### Task 13: Make.com scenario and Supabase webhooks

**Files:** Create `docs/make-scenario.md`

**Interfaces:**
- Consumes: `bookings`, `loans`, `booking_events` (T4); event text templates (spec §7, built with `format.js` wording).
- Produces: Make scenario "ITC booking log" (Custom webhook → Router with 5 routes → Supabase *Create a Row* in `booking_events`), two Supabase Database Webhooks (Dashboard › Database › Webhooks: `bookings` INSERT+UPDATE, `loans` INSERT+UPDATE, POST to the Make webhook URL).

- [ ] **Step 1:** Create the webhook and scenario (Make MCP or UI). Date text in Make: `formatDate(parseDate(record.date; "YYYY-MM-DD"); "ddd D MMM")`; hours padded to `HH:00`. Route filters exactly: `table = bookings & type = INSERT`; `table = bookings & type = UPDATE & old_record.status = confirmed & record.status = cancelled`; `table = loans & type = INSERT`; `table = loans & type = UPDATE & record.status = out`; `… = returned`.
- [ ] **Step 2: Verify:** book an hour in the app → Make history shows a successful run, `select kind, text, source from booking_events order by id desc limit 1` → `booking.created | Booked Court I for … | Make.com`, and the Booking detail history shows it within a few seconds (Realtime). Repeat for a cancel and a loan.
- [ ] **Step 3:** Write `docs/make-scenario.md` with the module list, filters, field mappings and a screenshot slot. **Checkpoint.**

### Task 14: Deploy pipeline, README, submission checklist

**Files:** Create `.github/workflows/deploy.yml`; modify `README.md`

**Interfaces:** Consumes the build from Task 1.

- [ ] **Step 1:** Workflow: on `push` to `main` and `workflow_dispatch`; jobs `build` (Node 20, `npm ci`, `npm test`, `npm run build` with env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from secrets and `VITE_BASE=/${{ github.event.repository.name }}/`, `actions/upload-pages-artifact@v3` path `dist`) and `deploy` (`actions/deploy-pages@v4`, permissions `pages: write`, `id-token: write`).
- [ ] **Step 2: Verify locally:** `VITE_BASE=/courtBooking/ npm run build && npx vite preview --base /courtBooking/` → app loads at `/courtBooking/#/home` and logos resolve.
- [ ] **Step 3:** README: what it is, stack, local setup (`cp .env.example .env`, fill keys, `npm i`, `npm run dev`), Supabase setup (run migrations 0100→0400 in order, run `supabase/tests/rules_check.sql`, turn off email confirmation, promote an admin with `update profiles set role='admin' where id = …`), Make setup (link to `docs/make-scenario.md`), deploy (add two repo secrets, Settings › Pages › Source: GitHub Actions), and the submission checklist (ZIP of source without `node_modules`; screenshots: booking form, My bookings list, `bookings` and `booking_events` tables with rows, Make scenario with a successful run).
- [ ] **Step 4: Checkpoint** (user pushes to GitHub and enables Pages).
