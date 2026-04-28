# Tonight's run sheet — Pulse Dev Hub

> Generated 2026-04-27 ~23:15 CT. Target: operational and brand-aligned by morning (2026-04-28).
> Sister to `TONIGHT.md` (which covers the social tool). User read-this-first file lives at `MORNING_BRIEF_DEV.md` once tonight's work ships.

## Why this exists

`apps/dev` (the Pulse Dev Hub) is the project-management and monitoring tool for our software work. It needs to track everything we have on:

- **GitHub** — last commit, open PR/issue counts, default branch
- **Local filesystem** — current branch, uncommitted file count, last touched
- **Vercel** — most recent deploy state, URL, commit SHA

…and turn that into a single command center that tells us what to look at next.

Today the scaffold exists (DB schema, three monitor modules, basic CRUD, skeleton pages) but it's wearing a generic dark indigo skin and the homepage is just a task list. We're going to turn it into the real thing tonight.

## What's already live

- `dev` schema in Supabase with `projects`, `tasks`, `repo_activity`, `fs_snapshots`, `deployments` (migration 0005)
- Server actions: create/update project, create/update/delete task
- Pages: `/` (today list), `/projects`, `/projects/new`, `/projects/[slug]`, `/tasks`
- Monitors: `lib/monitors/{github,fs-watcher,deploy}.ts` with `pollAllProjects`, `scanAllProjects`, `pollAllDeploys`
- Local CLIs: `pnpm fs:scan`, `pnpm gh:poll`
- HTTP triggers: `POST /api/monitor/github`, `POST /api/monitor/deploy`
- Local DB connection working via `PG_URL` (Supabase pooler)

## What ships tonight

### Track A — Pulse design system migration (core, lead from main thread)
**Why:** Right now the dev hub looks like a generic admin template (ink + indigo). Pulse Social already wears the warm editorial luxury palette; the dev hub has to feel like its sister, not a cousin from another agency.
- Swap tailwind palette to cream / green-deep / amber, drop the indigo/sky/ink scale.
- Load Playfair Display + Montserrat (same as social), wire `--font-display` + `--font-body`.
- Bring over `.grain`, `.eyebrow`, `.italic-amber`, `.shear-bottom`, focus ring (amber), signature easing.
- Re-skin Shell, TopBar, BrandMark, ProjectCard, TaskRow, StateChip, QuickTaskForm, project detail.
- New `BrandMark` matches the Pulse "stacked square" mark from the brand book (we already have `pulse-mark.png` in `apps/dev/public/brand/`).
- No-jargon voice in every label ("Inbox zero", "Quiet on the wire", etc.).

### Track B — Command Center home page (lead)
- Replace flat today list with hero tiles: total active projects, in-flight tasks, dirty repos, failing deploys, stale > 14d.
- Live-ish "On the wire" feed: latest commits across all repos (last 20).
- Attention rail: P0/P1 tasks, overdue, blocked.
- Per-project pulse cards (alphabetical, grouped by state).
- Quick actions: Refresh now, Add task, Add project, Discover projects.

### Track C — Project detail enrichment (lead)
- Header rewrite: name + state + current focus + italic-amber reframe ("Building <em>{current_focus}</em>")
- Quick-actions row: GitHub repo, Vercel project, Open in Finder (macOS `file://` href), local path
- Recent commits list (latest 10 from `dev.repo_activity` history)
- Deployment history (latest 5 from `dev.deployments`)
- Filesystem timeline (latest 5 fs_snapshots — "branch X, dirty/clean")
- Task kanban (in-progress / next / blocked / backlog columns)

### Track D — Project autodiscovery (parallel sub-agent)
**Why:** Manually adding 20+ projects is friction. The user already has `DEV_PROJECTS_ROOT=/Users/christian/Developer`; we should walk it.
- `lib/discovery.ts` walks DEV_PROJECTS_ROOT one level deep, finds `.git` repos, parses `git config --get remote.origin.url`, infers `owner/name` from the URL.
- `/projects/discover` page lists candidates with checkboxes, an inferred name + slug, and a single "Import selected" button.
- `bulkCreateProjects` server action — idempotent on slug + local_path.

### Track E — Cron + webhooks + manual refresh (parallel sub-agent)
**Why:** Polling has to happen automatically or none of it is real.
- New API route `app/api/cron/refresh-monitors/route.ts` — runs github + deploy pollers (skips FS, which needs the local disk). Authed by `CRON_SECRET`.
- `vercel.json` (project-scoped under `apps/dev/vercel.json`) registers the cron — `0 */6 * * *` every 6 hours.
- New `app/api/webhooks/vercel/route.ts` — receives Vercel deployment-state webhook, validates by `x-vercel-signature` (HMAC sha1 with `VERCEL_WEBHOOK_SECRET`), upserts a deployment row.
- New `app/api/webhooks/github/route.ts` — receives push + pr + deploy events, validates by `x-hub-signature-256` (HMAC sha256 with `GITHUB_WEBHOOK_SECRET`), upserts a `repo_activity` row.
- "Refresh now" button on the dashboard hits both monitor endpoints in parallel and revalidates.

### Track F — Task board polish (parallel sub-agent or inline)
- `/tasks` gets a Kanban-style "by status" board (in_progress, next, blocked, backlog) plus a "Due soon" sweep (overdue + due in 7 days).
- Today rail on `/` injects P0/P1/in-progress/due-today tasks.

### Track G — Global search + mobile (inline, time-permitting)
- ⌘K opens a search palette over projects + tasks.
- Top bar collapses below `md`. Touch targets ≥ 44px on phone.

### Track H — Cross-tool bridge (inline, optional)
- Read-only Supabase client targeting the `public` schema reads `clients` count, current month's open shoots count, and surfaces them in a small "Sister tool" widget on the dashboard. (Honors the entity-ownership rule — read only, never write `public.*` from the dev hub.)

### Track I — Build + deploy (lead, last)
- `pnpm --filter @pulse/dev build`
- Fix lint + type errors as they surface.
- Push the project to its own Vercel project (separate from `pulse-tool-mauve`). New `apps/dev/vercel.json`.
- Smoke routes: `/`, `/projects`, `/projects/new`, `/projects/discover`, `/tasks`, `/api/cron/refresh-monitors`.

## Coordination

- Two sub-agents run in parallel on Tracks D and E (both touch isolated files only — no merge collisions). Main thread does A/B/C/F/G/H/I.
- After each agent completes, integrate cleanly into main, run typecheck.

## Verification before bed

1. `pnpm --filter @pulse/dev build` succeeds.
2. `/` renders the new dashboard with mock data when monitors haven't run.
3. `/projects/discover` lists at least the projects under `~/Developer`.
4. `POST /api/cron/refresh-monitors` returns 401 without `CRON_SECRET`, 200 with it.
5. Vercel deployment URL is live; brief smoke test in browser.

## What the user has to do in the morning

Captured in `MORNING_BRIEF_DEV.md`. Top items:

1. Drop these into the dev hub's Vercel project envs:
   - `GITHUB_TOKEN` — fine-grained PAT with `repo:read`
   - `VERCEL_TOKEN` — from <https://vercel.com/account/tokens>
   - `VERCEL_TEAM_ID` (optional, only if the projects live in a team)
   - `CRON_SECRET` — any random string; same string the cron header sends
   - `VERCEL_WEBHOOK_SECRET` — random string; paste into Vercel webhook config
   - `GITHUB_WEBHOOK_SECRET` — random string; paste into GitHub repo webhook config
   - `PG_URL` — already in your `.env.local`; copy/paste it to Vercel
   - `DEV_PROJECTS_ROOT` — for local fs:scan use only; not needed in Vercel env
2. (Optional) wire each repo's GitHub webhook to `https://<dev-hub-domain>/api/webhooks/github` (push + pull_request).
3. (Optional) wire each Vercel project's deployment webhook to `https://<dev-hub-domain>/api/webhooks/vercel`.
4. Run `pnpm --filter @pulse/dev fs:scan` once locally so filesystem rows are populated. (FS scan stays local — it needs the actual disk.)
5. Click "Discover projects" on the dev hub home, import the ones you actually care about, and you're off.
