# DilapTrack

Property dilapidation surveys and close-out for a construction project, with a landholder (landowner) register. Built for site
engineers and project teams. It runs on phones on site and on desktops in the office.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth,
Storage, Row Level Security) · Cloudflare Workers (via OpenNext), or Vercel.

## What it does

| Area | Details |
|---|---|
| **Dashboard** | Total lots, pre/post-construction surveys complete, lots awaiting landholder acceptance, lots closed / outstanding, lots by status, upcoming surveys (overdue highlighted), lots ready to close, recent activity. |
| **Lot register** | Lot number, address, landholder, chainage, status, assigned engineer, notes. Search, filter (status, engineer, outstanding surveys, ready to close), sort by lot number or chainage, CSV export. Phone-friendly card view. |
| **Landholder register** | Landowners and occupiers: name, phone, email, postal address, notes, and the lots each one owns. On the lot form, choose the landholder from a searchable list, or add a new one without leaving the form. Names are unique, ignoring case and spacing. A landholder with lots can't be deleted. CSV export. |
| **Lot import** | Excel (.xlsx) or CSV. Columns are auto-matched by heading (and can be changed). Every row is validated in a preview before anything is saved. Duplicate lots within the file are flagged, and lot numbers already in the register are skipped, never overwritten. Landholder names are matched to the register; new names are added to it with the phone or email from the file. |
| **Surveys** | One pre-construction and one post-construction survey per lot, created automatically: date, surveyor, notes, status, photos, videos and the PDF report. |
| **Files** | Supabase Storage, organised per lot: `LOT-001/pre-construction`, `post-construction`, `closeout`. Drag-and-drop or "Take photo" on phones. Gallery with full-screen viewer, captions and download. Originals are kept untouched; a small JPEG preview is generated in the browser for fast galleries and PDF reports. |
| **Close-out** | A lot can only be closed when the pre-construction survey is complete, the post-construction survey is complete, and landholder acceptance is recorded (name, date, notes, plus the signed form in the Closeout folder). The database enforces this as well as the UI. A closed lot's records are locked until it is reopened. |
| **Reports (PDF)** | Project Summary, Individual Lot Report, Dilapidation Survey Report (photographic record) and Landholder Report. For one landholder, the Landholder Report is a single combined pack: their details, every lot's full report and survey photos, and every PDF uploaded to their lots (survey reports, signed forms) merged in as a labelled appendix. For all landholders, it is a contact and status summary. The server returns the report data (permission-checked); the PDF is drawn in the browser, so photo-heavy reports don't hit server CPU limits. |
| **Demo data** | Users → Demo data → *Load demo data* (administrators) adds 8 landholders and 12 lots, DEMO-01 to DEMO-12. They cover every stage from not started to closed, with sample photos, survey reports and signed acceptance forms. *Remove demo data* deletes them again, including their files. |
| **Audit trail** | Every insert, update and delete on lots, surveys, landholders, files and user roles is recorded by a database trigger: who, when, and before → after for each field. History tab per lot, plus a project-wide audit log. The log can't be edited through the app or API. |
| **Other** | Dark mode (light / dark / system), responsive layout with a bottom tab bar on phones, Australian date formats. |

## Users and permissions

| Role | Can |
|---|---|
| Administrator | Everything, including inviting users and changing roles. |
| Project Manager | View and manage all records: lot register, import, landholder acceptance, close/reopen lots, delete lots and landholders. |
| Site Engineer | View everything; fill in surveys; upload photos, videos and documents; add and update landholders; delete their own uploads. |
| Read Only | View records and download reports. |

The same rules are enforced by Row Level Security in Postgres and Storage policies, so the UI is not the only line
of defence. Other safeguards:

* The **first account** created becomes an active administrator. Later accounts start with **no access** until
  an administrator activates them. A self-registered stranger therefore can't see anything.
* Only administrators can change roles or activation, and the last active administrator can't be removed. Both are
  enforced by triggers.
* Accounts are created by invitation. Public sign-up is disabled in `supabase/config.toml`; turn it off in the
  hosted project too.

## Project layout

```
dilaptrack/
├── supabase/
│   ├── migrations/…_dilaptrack_init.sql   Schema, RLS, triggers (audit, close-out, lot import), storage bucket + policies
│   ├── migrations/…_dilap_focus.sql       Removes defects/reinstatement; adds the landholder register
│   ├── templates/                          Invite / password-reset / magic-link emails
│   ├── seed.sql                            A few lots for local development
│   └── config.toml                         Local Supabase settings
├── src/
│   ├── middleware.ts                       Refreshes the session, sends signed-out users to /login
│   ├── actions/                            Server Actions (lots, landholders, records, users, demo, auth) — all permission-checked
│   ├── app/
│   │   ├── (app)/                          Signed-in pages: dashboard, lots/[id]/…, landholders, reports, audit, admin/users
│   │   ├── api/reports/[type]/route.ts     Report data as JSON (summary | lot | survey | landholder)
│   │   ├── login, forgot-password, auth/confirm, pending
│   ├── components/                         UI kit, app shell, file uploader/gallery, lot & landholder components
│   ├── lib/                                Supabase clients, auth/permissions, import parsing, close-out rules, formatting
│   └── reports/                            react-pdf report documents, drawn in the browser (render.tsx)
└── tests/
    ├── unit/                               Import validation, storage paths, close-out checklist, CSV
    └── db/                                 Runs the real migration on PGlite and tests RLS, triggers and rules
```

## Setting up Supabase (once)

1. **Create a project** at [supabase.com](https://supabase.com). Choose a region close to the team
   (e.g. Sydney).
2. **Apply the database migrations** (all files in `supabase/migrations`, in name order). Either:
   * with the CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`, or
   * paste each file into **SQL Editor** and run it, oldest first: `20261013000000_dilaptrack_init.sql`, then
     `20261014000000_dilap_focus.sql`.

   This creates the tables, policies, triggers and the private `lot-files` storage bucket.
3. **Authentication settings** (Dashboard → Authentication):
   * *Sign In / Providers → Email*: turn **off** "Allow new users to sign up". Minimum password length: 8.
   * *URL Configuration*: set **Site URL** to your app URL (e.g. `https://dilaptrack.vercel.app`) and add
     `https://dilaptrack.vercel.app/**` (and `http://localhost:3000/**` for development) to **Redirect URLs**.
   * *Emails → Templates*: paste in `supabase/templates/invite.html`, `recovery.html` and `magic_link.html`.
     Their links point at `/auth/confirm?token_hash=…`, so they work on any device. With the default templates the
     links still work, but only in the same browser.
   * For real email delivery, configure custom SMTP (Authentication → Emails → SMTP). The built-in sender is rate
     limited.
4. **Create the first administrator**: Authentication → Users → *Add user* (with a password, auto-confirm). The first
   account automatically becomes an active Administrator. Invite everyone else from the app's **Users** page.
5. **File size limit**: Storage → Settings. The Free plan allows 50 MB per file. On Pro you can raise it for
   longer videos; also set `NEXT_PUBLIC_MAX_UPLOAD_MB` to match.

## Running locally

Requires Node 20.9+ and, for a local database, Docker.

```bash
cd dilaptrack
npm install
npx supabase start                 # local Postgres/Auth/Storage, applies the migration + seed.sql
cp .env.example .env.local         # fill in the URL + publishable key printed by `supabase start`
npm run dev                        # http://localhost:3000
```

Create your first user in the local Studio (`http://127.0.0.1:54323` → Authentication → Add user). Invitation and
password-reset emails are caught by Mailpit at `http://127.0.0.1:54324`.

Alternatively, point `.env.local` at a hosted Supabase project and skip Docker.

### Checks

```bash
npm run lint
npm run typecheck
npm test          # unit tests + database tests (the real migration on in-process Postgres; no Docker needed)
npm run build
```

The GitHub workflow `.github/workflows/dilaptrack.yml` runs all four on every push that touches `dilaptrack/`, then deploys (see below).

## Deploying to Cloudflare (current setup)

The app runs as a Cloudflare Worker called `dilaptrack`, built with
[OpenNext for Cloudflare](https://opennext.js.org/cloudflare). It is separate from the procurement planner's Worker.

**Automatic deploys:** `.github/workflows/dilaptrack.yml` checks and deploys on every push to `main`. To deploy
another branch, use **Actions → DilapTrack → Run workflow**. It uses these repository secrets (Settings → Secrets and
variables → Actions):

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token with *Edit Cloudflare Workers* permission (shared with the procurement planner) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (shared) |
| `SUPABASE_SECRET_KEY` | Optional. Supabase secret (or `service_role`) key; enables **Invite** on the Users page |

The public Supabase settings live in `.env.production` (URL and publishable key, safe to commit). To show your
project's name on PDF reports, add `NEXT_PUBLIC_PROJECT_NAME=...` there.

**After the first deploy:** the app is at `https://dilaptrack.<your-subdomain>.workers.dev` (Cloudflare dashboard →
Workers & Pages → dilaptrack). In Supabase → Authentication → URL Configuration, set **Site URL** to that address and
add `https://dilaptrack.<your-subdomain>.workers.dev/**` to **Redirect URLs**. Otherwise invitation and
password-reset links point at localhost. You can also add a custom domain to the Worker in Cloudflare.

**From your own computer:** `npx wrangler login`, then `npm run cf:deploy`. Use `npm run cf:preview` to run the
Worker build locally (reads `.dev.vars`, same format as `.env.local`).

**Plan:** a Next.js app with sign-in and several database queries per page can exceed the Workers Free plan's
10 ms CPU limit per request, which shows up as Cloudflare error 1102. Workers Paid ($5/month) is recommended. The bundle is
about 2.4 MB compressed, within both plans' size limits.

**Notes:**
* Next.js is pinned to 16.3.8, the newest version the OpenNext adapter currently supports.
* The session hook is `src/middleware.ts` (Edge runtime) rather than Next 16's `proxy.ts`, because Edge
  middleware is what OpenNext supports on Workers.
* Smart Placement is on (`wrangler.jsonc`), so the Worker runs near the Supabase database.

## Deploying to Vercel (alternative)

1. In Vercel, **Add New → Project**, import this repository and set **Root Directory** to `dilaptrack`.
2. Add environment variables `SUPABASE_SECRET_KEY` (server-only), `NEXT_PUBLIC_SITE_URL` and optionally
   `NEXT_PUBLIC_PROJECT_NAME` / `NEXT_PUBLIC_MAX_UPLOAD_MB`. The Supabase URL and publishable key come from
   `.env.production`; set them in Vercel too if you want to override them.
3. Deploy, then add the Vercel URL to Supabase **Site URL** / **Redirect URLs**.

`vercel.json` pins the functions to Sydney (`syd1`). Change the region to match your Supabase project.

## Importing lots

Use **Lots → Import** and download the template, or use your own spreadsheet. The first row must hold headings.
Recognised headings include *Lot / Lot No / Lot Number*, *Address / Property Address*, *Landholder / Owner*,
*Contact / Phone / Email*, *Chainage / CH*, *Status*, *Engineer / Assigned Engineer*, *Notes / Comments*. Only the
lot number is required. Status may be *Not started*, *In progress* or *On hold*, or blank. Lots can't be imported
as closed. Chainage can be written `12+345`, `CH 12345` or `12345` and is sorted numerically.

## Notes on design decisions

* **Server-rendered, per request.** Every page depends on the signed-in user, so pages render on demand. Reads use
  the user's own Supabase session, so RLS applies to every query. Mutations are Server Actions that re-check
  permissions before touching the database.
* **Uploads go straight from the browser to Supabase Storage.** This avoids Vercel's request-size limit. The
  storage policy decides who may upload, and the file's metadata row is checked against the same rules.
* **Database-enforced business rules.** Close-out conditions, locking of closed lots, unique lot numbers,
  "completed needs a date", one pre/post survey per lot, and the audit trail all live in Postgres. They hold no
  matter how data is changed.
* **Regenerating types:** after changing the schema, run `npm run db:types` (local) or
  `npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts`.
