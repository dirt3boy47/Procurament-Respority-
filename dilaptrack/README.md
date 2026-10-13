# DilapTrack

Property dilapidation surveys, defects, reinstatement and close-out for a construction project. Built for site
engineers and project teams. It runs on phones on site and on desktops in the office.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth,
Storage, Row Level Security) · Vercel.

## What it does

| Area | Details |
|---|---|
| **Dashboard** | Total lots, pre/post-construction surveys complete, open defects, open reinstatement, lots closed / outstanding, lots by status, urgent defects, lots ready to close, recent activity. |
| **Lot register** | Lot number, address, landholder (+ contact), chainage, status, assigned engineer, notes. Search, filter (status, engineer, outstanding surveys, ready to close), sort by lot number or chainage, CSV export. Phone-friendly card view. |
| **Lot import** | Excel (.xlsx) or CSV. Columns are auto-matched by heading (and can be changed). Every row is validated in a preview before anything is saved. Duplicates within the file are flagged. Lot numbers already in the register are skipped, never overwritten. Matching is case-insensitive, and the database enforces uniqueness. |
| **Surveys** | One pre-construction and one post-construction survey per lot, created automatically: date, surveyor, notes, status, photos, videos and the PDF report. |
| **Files** | Supabase Storage, organised per lot: `LOT-001/pre-construction`, `post-construction`, `defects`, `reinstatement`, `closeout`. Drag-and-drop or "Take photo" on phones. Gallery with full-screen viewer, captions and download. Originals are kept untouched; a small JPEG preview is generated in the browser for fast galleries and PDF reports. |
| **Defects** | Lot, description, photos, priority, status, assigned to, due date. Overdue highlighting. Project-wide register with filters and CSV export. |
| **Reinstatement** | Required works, status, completion date, photos, landholder acceptance (+ date), notes. Project-wide register. |
| **Close-out** | A lot can only be closed when the pre-construction survey is complete, the post-construction survey is complete, all defects are closed, all reinstatement is complete and landholder acceptance is recorded. The database enforces this as well as the UI. A closed lot's records are locked until it is reopened. |
| **Reports (PDF)** | Individual Lot Report, Dilapidation Survey Report (photographic record), Reinstatement Report (project or lot), Project Summary Report. |
| **Audit trail** | Every insert, update and delete on lots, surveys, defects, reinstatement, files and user roles is recorded by a database trigger: who, when, and before → after for each field. History tab per lot, plus a project-wide audit log. The log can't be edited through the app or API. |
| **Other** | Dark mode (light / dark / system), responsive layout with a bottom tab bar on phones, Australian date formats. |

## Users and permissions

| Role | Can |
|---|---|
| Administrator | Everything, including inviting users and changing roles. |
| Project Manager | View and manage all records: lot register, import, landholder acceptance, close/reopen lots, delete records. |
| Site Engineer | View everything; fill in surveys; upload photos, videos and documents; create and update defects and reinstatement items; delete their own uploads. |
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
│   ├── templates/                          Invite / password-reset / magic-link emails
│   ├── seed.sql                            Demo lots for local development
│   └── config.toml                         Local Supabase settings
├── src/
│   ├── proxy.ts                            Refreshes the session, sends signed-out users to /login
│   ├── actions/                            Server Actions (lots, records, users, auth) — all permission-checked
│   ├── app/
│   │   ├── (app)/                          Signed-in pages: dashboard, lots/[id]/…, defects, reinstatement, reports, audit, admin/users
│   │   ├── api/reports/[type]/route.ts     PDF generation (lot | survey | reinstatement | summary)
│   │   ├── login, forgot-password, auth/confirm, pending
│   ├── components/                         UI kit, app shell, file uploader/gallery, lot & record components
│   ├── lib/                                Supabase clients, auth/permissions, import parsing, close-out rules, formatting
│   └── reports/                            react-pdf report documents
└── tests/
    ├── unit/                               Import validation, storage paths, close-out checklist, CSV
    └── db/                                 Runs the real migration on PGlite and tests RLS, triggers and rules
```

## Setting up Supabase (once)

1. **Create a project** at [supabase.com](https://supabase.com). Choose a region close to the team
   (e.g. Sydney).
2. **Apply the database migration.** Either:
   * with the CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`, or
   * paste `supabase/migrations/20261013000000_dilaptrack_init.sql` into **SQL Editor** and run it.

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

The GitHub workflow `.github/workflows/dilaptrack.yml` runs all four on every push that touches `dilaptrack/`.

## Deploying to Vercel

1. In Vercel, **Add New → Project**, import this GitHub repository and set **Root Directory** to `dilaptrack`.
   The framework (Next.js) is detected automatically.
2. Add environment variables (Production and Preview):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Settings → API) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (or the legacy `anon` key) |
   | `SUPABASE_SECRET_KEY` | Secret key (or legacy `service_role`). Only needed for inviting users. **Server-only.** |
   | `NEXT_PUBLIC_SITE_URL` | e.g. `https://dilaptrack.vercel.app` (used in email links) |
   | `NEXT_PUBLIC_PROJECT_NAME` | Shown on PDF reports, e.g. `Northern Pipeline Upgrade` |
   | `NEXT_PUBLIC_MAX_UPLOAD_MB` | Optional, default 50 |

3. Deploy. Pushes to the default branch deploy to production; other branches get preview URLs.
4. Add the production URL to Supabase **Site URL** / **Redirect URLs** (step 3 above).

`vercel.json` pins the functions to Sydney (`syd1`) to sit next to a Sydney Supabase project. Change the region if
your Supabase project is elsewhere.

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
