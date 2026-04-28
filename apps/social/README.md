# Pulse Social Planning

Web app port of the `Pulse_Social_Monthly_Template.xlsx` planning system.
Tells you what posts are planned, what needs to be captured, where the gaps
are, and whether the month is ready to ship.

- **Stack**: Next.js 15 (App Router) · Supabase (Postgres + Storage) · Tailwind · TypeScript
- **Auth**: none for v1 (single shared workspace; gate via private URL or Vercel password protection)
- **Asset storage**: pluggable provider — `GoogleDriveLinkProvider` ships, `DamApiProvider`/`NasFsProvider` plug in later

## Pages

- `/` — pick a client, or add a new one
- `/clients/[slug]` — month overview cards (this month + 2 ahead) with KPIs and gate progress
- `/clients/[slug]/strategy` — Strategic Frame + monthly quotas
- `/clients/[slug]/months/[yyyy-mm]/planning` — inline-editable post grid + shoot bundles + live coverage rail
- `/clients/[slug]/months/[yyyy-mm]/production` — shoot schedule with auto-filled capture lists, coverage gaps, and the 7 ready-to-send checks
- `/clients/[slug]/months/[yyyy-mm]/calendar` — month grid view
- `/clients/[slug]/months/[yyyy-mm]/shoots/[n]/shotlist` — print-friendly shot list for the field
- `/holidays`, `/shoot-templates` — global reference editors

## Local setup

```bash
# 1) Install
pnpm install

# 2) Spin up Supabase (Docker required)
brew install supabase/tap/supabase
supabase start

# 3) Apply schema
supabase db reset

# 4) Wire env vars — copy .env.example to .env.local and fill in:
#      NEXT_PUBLIC_SUPABASE_URL
#      NEXT_PUBLIC_SUPABASE_ANON_KEY
#      SUPABASE_SERVICE_ROLE_KEY
#    (`supabase status` prints these for the local stack)

# 5) Seed from the existing spreadsheet
pnpm import ~/Downloads/Pulse_Social_Monthly_Template.xlsx

# 6) Run
pnpm dev
```

The importer is idempotent: it upserts clients, shoot templates, holidays, the
strategic frame, and quotas, and rebuilds the ONSC May 2026 plan (the populated
month in the spreadsheet) so you have real data to look at.

## Tests

```bash
pnpm test
```

`lib/computations.test.ts` is a parity suite: capacity, coverage rows, lead-time
status, and the 7 validation gates run against fixtures derived directly from
the spreadsheet's ONSC May 2026 plan and `Shoot Templates` sheet.

## Deploy

1. Create a Supabase project; apply `supabase/migrations/0001_init.sql` to it.
2. Push the repo to GitHub; import into Vercel.
3. Set the same env vars in Vercel.
4. Turn on **Vercel password protection** (Settings → Deployment Protection) —
   that's the auth posture for v1.

## Architecture in one paragraph

Server Components fetch via `lib/queries.ts`, mutations go through Server
Actions in `lib/actions.ts`. All planning math is in `lib/computations.ts`
(pure functions, unit-tested, single source of truth for both the Planning
rail and the Production page). Asset linking goes through `AssetProvider` in
`lib/assets/provider.ts`; only `google-drive.ts` is wired in v1, but the DB
schema and interface are ready for DAM/NAS providers later.

## Swapping the asset provider

When you adopt the DAM:

1. Add `lib/assets/dam.ts` implementing `AssetProvider`.
2. Export it from `lib/assets/index.ts` (or replace the `drive` import in the
   places that consume it — there's only one).
3. Add `provider = 'dam'` rows in the `assets` table; the schema already
   supports it.

No UI changes required.

## What's deliberately out of scope (v1)

- Auth & RBAC
- Live posting via Meta / Buffer / Later APIs
- DAM/NAS providers (interface only)
- Comments / approvals / notifications
- AI caption generation
