# T2W Pipeline — Procurement planner

Schedules orders for valves, pits and fittings against the T2W programme, tracks
purchase orders and deliveries, and checks that the right bill of materials (BOM)
was ordered for every asset before it's needed on site.

It reads the **asset register** and **programme** from the `T2W Production`
Supabase project — the same data the works-tracking site (`db-t2w`) uses — and
keeps all of its own data separate, so the two sites can't interfere.

## How it works

| Step | Where |
|---|---|
| Every register asset in an active **category** (AV, SCV, IV, PIG, DICL bends, MSCL bends) gets a **need-on-site date** = earliest planned start of the programme activities linked to it (`app_schedule_activity_asset`), unless you override it. | Order schedule |
| **Order-by date** = need date − lead time − buffer. Lead time comes from the category, or a BOM line's own lead time if longer. | Settings → categories |
| Status: *Overdue to order* → *Order now* (within the lookahead, default 21 days) → *Planned*, then *Part ordered* / *Ordered* / *Received* / *Installed*. | Dashboard, Order schedule |
| Each **assembly** (e.g. `AV TYPE 1A \| DN600x300`, `DICL DN600 11.25° HOR`) has one **BOM template**: the items one asset of that type needs. Templates start as *Draft* and must be **approved**. | BOM templates |
| Select assets on the schedule (or a whole order-week group) → **Create PO**: outstanding BOM quantities are grouped into PO lines, each allocated back to the assets it's for. | Order schedule → PO |
| Issue the PO, record deliveries (dockets) as they arrive. | Purchase orders |
| On each asset, the **BOM check** shows required vs on-draft vs ordered vs received per item. Once every line is on an issued PO, **Confirm the correct BOM is ordered** signs it off. If the BOM or the orders change later, the confirmation is flagged *re-check*. | Asset page |

Starter BOM templates were generated for all 84 assemblies in the register, holding
only what the register states (branch tee size, valve assembly group, bend size/angle).
**Expand each into the full component list from the standard drawings, then approve it.**
The category lead times are placeholders — set real ones in Settings.

### Roles (from `app_profiles`, same accounts as the works site)

| Role | Access |
|---|---|
| admin | everything, incl. categories/lead times and settings |
| superintendent | plan, BOM templates, suppliers, POs |
| crew_chief | view, and record deliveries |
| client roles / pending | no access |

## Keeping it separate from the works site (`db-t2w`)

* **Own schema.** All procurement data lives in the `procurement` schema. Nothing in `public` was altered; no triggers, no foreign keys onto works tables (so imports, resets and backups in the works app are unaffected).
* **Read-only access to the register.** The register, programme and user profiles are read through views (`procurement.v_register`, `v_activity`, `v_activity_link`, `v_user`).
* **Database-enforced.** The API runs every request as the `procurement_app` role, which has **no privileges on `public`**. Even a bug in this app can't write to the works tables (covered by a test).
* **Own API.** A separate edge function, `t2w-procurement-api`. It never accepts SQL from the browser — only named actions — and it doesn't use or change the works app's `t2w-sql` / `t2w-admin-auth` functions.
* **Own Worker, URL and cookies.** Worker `t2w-procurement` (→ `t2w-procurement.<subdomain>.workers.dev`), cookies `t2wp_at` / `t2wp_rt`. Signing out here uses a *local-scope* logout so it doesn't end your works-site session.
* **Not exposed via the Supabase Data API.** `anon` / `authenticated` have no access to the `procurement` schema.

## Layout

```
src/worker.js                                   Cloudflare Worker: static site + /api proxy + login cookies
public/                                         The site (same look as the works register)
supabase/migrations/…_procurement_init.sql      Schema, views, seed categories and starter BOM templates
supabase/functions/t2w-procurement-api/         Edge function: index.ts (auth, DB) + api.ts (all actions)
test/                                           API tests on PGlite (real Postgres in-process) + Worker tests
scripts/dev-server.mjs                          Local preview with synthetic data — no Supabase/Cloudflare needed
```

## Running locally

```bash
npm install
npm test                         # 11 tests: SQL views, API flows, permissions, isolation, Worker auth
node scripts/dev-server.mjs      # http://localhost:8788 with synthetic demo data (signed in as admin)
```

## Deploying

**Database + API** — already applied to `T2W Production` (migration `procurement_init`,
edge function `t2w-procurement-api`). To redeploy the function after changes:
`supabase functions deploy t2w-procurement-api --no-verify-jwt` (it checks the
user's session itself).

**Website (Cloudflare Worker)** — either:

* GitHub Actions: add repository secrets `CLOUDFLARE_API_TOKEN` (template *Edit Cloudflare Workers*)
  and `CLOUDFLARE_ACCOUNT_ID`; every push to `main` tests and deploys.
* Or from a PC: `npx wrangler login && npx wrangler deploy`.

No secrets are needed in the Worker: it only holds the Supabase URL and the public
(publishable) key, which are safe in a browser.

Note: this repository is public — don't commit register exports or credentials.
