# Intania Tennis Club Courts

Court booking and equipment borrowing for Intania Tennis Club at CUB 13, built for the ISE Vue Web Application Integration Assignment. Students book courts, reserve rackets and balls, and view their playing history. Club admins manage bookings, courts, equipment, and the activity log. Dates and hours use Asia/Bangkok (UTC+7).

## Stack

- Node.js 22 or newer; npm.
- Vue 3, Vue Router 4 with hash history, and Vite 5.
- Supabase JavaScript client v2, Auth, Postgres with triggers and row-level security, and Realtime.
- Make.com for booking and loan activity logging.
- Vitest 2, Vue Test Utils, and jsdom for unit tests.
- GitHub Actions for CI; Vercel for hosting.

## Local setup

Install Node.js 22 or newer, then from the project root:

```sh
cp .env.example .env
npm ci
```

In PowerShell, use `Copy-Item .env.example .env` to copy the template. If execution policy blocks `npm.ps1`, use `npm.cmd` for the npm commands.

Fill in the local `.env` file with your Supabase project URL and anonymous/publishable client key:

```dotenv
VITE_SUPABASE_URL=<SUPABASE_PROJECT_URL>
VITE_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
VITE_BASE=/
```

These are placeholders. Keep `.env` out of source control. The service-role key belongs only in Make.com; never put it in a `VITE_` variable or browser code.

```sh
npm run dev
```

Open the local address printed by Vite. To test and build:

```sh
npm test
npm run build
npm run preview
```

Tests use the existing two-worker limit. The production build is written to `dist/`.

## Supabase setup

1. Create a Supabase project. In its SQL editor, run every file in `supabase/migrations/` as `postgres`, in filename order:
   1. `20261110000100_schema.sql`
   2. `20261110000200_rules.sql`
   3. `20261110000300_rls.sql`
   4. `20261110000400_seed.sql`
   5. `20261110000500_make_webhook.sql`
2. Still as `postgres`, insert each admin email into `public.admin_emails` **before that admin signs up**, and insert the Make custom webhook URL into `private.app_config` with key `make_webhook_url`. Replace the placeholders below only in your SQL editor:

   ```sql
   insert into public.admin_emails (email)
   values (lower(trim('<ADMIN_EMAIL>')))
   on conflict (email) do nothing;

   insert into private.app_config (key, value)
   values ('make_webhook_url', '<MAKE_CUSTOM_WEBHOOK_URL>')
   on conflict (key) do update set value = excluded.value;
   ```

   The signup trigger assigns the admin role from this allowlist. Adding an address later does not change an existing profile. The webhook migration installs the booking and loan triggers; it sends nothing until the URL is configured. Obtain the URL from the Make.com setup below, then return here to insert it.
3. Run `supabase/tests/rules_check.sql` as `postgres`. It checks booking and loan rules in a transaction, prints `all rules checks passed`, and rolls back its test data.
4. In Supabase **Authentication > Sign In / Providers > User Signups**, turn off **Confirm email** for the assignment demo. Before real students use the app: set up a custom SMTP sender (**Authentication > Emails > SMTP Settings**; the built-in sender allows only a few emails an hour), then turn **Confirm email** back on so nobody can sign up with someone else's Chula address. The app already tells new users to check their email when confirmation is on.
5. Copy the project URL and anonymous/publishable client key into the local `.env` file. Restart Vite after changing environment variables.

Create member accounts through the app. Courts and equipment are seeded; member profiles and bookings come from signups and actual use. Database triggers enforce booking and loan rules, and the client mirrors them for immediate feedback.

## Make.com setup

Follow [the Make scenario guide](docs/make-scenario.md) for the **ITC booking log** scenario, route filters, and field mappings.
Create a custom webhook and connect Supabase using the service-role key stored only in Make.com. Save the webhook URL in `private.app_config` as described above. Migration `0500` already sends booking and loan inserts/updates to that webhook; do not add duplicate database webhooks. Activate the scenario and confirm a booking, cancellation, and loan create the expected `booking_events` rows. The app receives those entries through Supabase Realtime. If Make is inactive, bookings still work but the activity log will miss those entries.

## Deploy to Vercel

The site is hosted on Vercel; GitHub Actions only runs CI.

1. In Vercel, **Add New > Project** and import this GitHub repository. Framework preset: **Vite** (build `npm run build`, output `dist`).
2. Under **Settings > Environment Variables**, add for Production and Preview:
   - `VITE_SUPABASE_URL`: the Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY`: the publishable client key.
   Leave `VITE_BASE` unset (the app is served from `/`).
3. Deploy. Every merge to `main` deploys to production; every pull request gets a preview URL.
4. In Supabase **Authentication > URL Configuration**, set **Site URL** to the Vercel production URL and add the preview URL pattern (`https://*-<your-vercel-scope>.vercel.app/**`) to **Redirect URLs**.

Routing uses the URL hash (`/#/home`), so no rewrite rules are needed.

## CI and protected `main`

[CI](.github/workflows/ci.yml) runs `npm ci`, `npm test` and `npm run build` on Node 22 for every pull request and every push to `main`. `main` is protected by a repository ruleset: changes arrive through a pull request, the `test-and-build` check must pass, and force-pushes and deletion are blocked. Work on a branch, open a pull request, wait for the check (and the Vercel preview), then merge.

## Submission checklist

- [ ] ZIP the source without `node_modules`, `dist`, `.env`, or any credentials; keep `.env.example`.
- [ ] Screenshot the booking form.
- [ ] Screenshot the My bookings list.
- [ ] Screenshot the Supabase `bookings` table with rows.
- [ ] Screenshot the Supabase `booking_events` table with rows.
- [ ] Screenshot the Make.com scenario with a successful run.
- [ ] Check the deployed app on phone and desktop and include its Vercel address with the submission.
