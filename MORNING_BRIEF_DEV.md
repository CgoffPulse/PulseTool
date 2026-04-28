# Morning brief — Pulse Dev Hub

> Read this first. Generated overnight 2026-04-27 → 2026-04-28.
> Sister doc to the social tool's `TONIGHT.md`.

## Where we landed

Pulse Dev Hub is **live in production** on Vercel.

- Production URL → https://pulse-dev-two.vercel.app
- Health check → https://pulse-dev-two.vercel.app/api/health
- Vercel project → `pulse-dev` (team `pulse-agency`)
- Latest deployment → `dpl_8WALA24dfHcDu6Jjk6TTCyz2D3No` (READY)

Right now the dashboard renders, the database is connected, and every page returns 200. What it's missing is **secrets** — without them the GitHub/Vercel monitors stay quiet, the cron job 401s, and the webhooks reject signed payloads. The next 20 minutes is mostly pasting tokens into Vercel and running one migration check.

## What we shipped overnight

| Track | What landed |
|---|---|
| Design system | Migrated `apps/dev` to the Pulse cream/green-deep/amber palette, Playfair Display + Montserrat, grain overlay, eyebrows, italic-amber, brand mark from `pulse-mark.png`. |
| Shell + TopBar | Mobile-aware top bar, footer with link to Pulse Social, ⌘K hint. |
| Command Center home | Hero with stats strip, Attention tile (failing deploys, urgent tasks, dirty repos, stale repos), Today section with quick-task entry, Activity Feed (commits + deploys), Projects-by-state. |
| Project detail | Hero with watermark + italic-amber focus, Quick Actions (GitHub / Finder / Cursor / Vercel), History panels (commits, deploys, fs snapshots), task management. |
| Discovery | `/projects/discover` walks `DEV_PROJECTS_ROOT`, infers GitHub remote, bulk import. CLI mirror at `pnpm discover` + `pnpm discover --apply`. |
| Tasks | Kanban + list toggle, Sweep Tiles for urgent/overdue/due-soon, status + priority pickers. |
| Cron | `/api/cron/refresh-monitors` (GET + POST), bearer-checked, wired into `vercel.json` at `0 */6 * * *`. Manual Refresh button on home. |
| Webhooks | `/api/webhooks/vercel` (HMAC-SHA1, x-vercel-signature) and `/api/webhooks/github` (HMAC-SHA256, x-hub-signature-256), both signature-verified. |
| Cross-tool | "Sister Tool" card on the home page reads social-tool stats from `public.clients/shoots/posts` and links back to Pulse Social. |
| ⌘K palette | Global command palette over projects + tasks + routes. |
| Health | `/api/health` reports DB + which secrets are present. |
| Build path | Inlined the two tiny workspace packages (`@pulse/db`, `@pulse/obsidian-sync`) so `apps/dev` deploys as a standalone Next.js app — no monorepo gymnastics on Vercel. |

## What you have to do this morning (in order)

### 1. Verify your envs in Vercel — 5 min

Open https://vercel.com/pulse-agency/pulse-dev/settings/environment-variables and confirm each of these has a value for **Production** (and Preview if you want previews to behave). The first one is already there since the DB came up healthy.

| Env var | What it is | Where to get it |
|---|---|---|
| `PG_URL` | Direct Postgres connection string for the Supabase project. Looks like `postgresql://postgres.<project>:<pwd>@aws-...pooler.supabase.com:6543/postgres`. | Supabase → Project Settings → Database → Connection string → "Transaction" pooler. Copy your local `apps/dev/.env.local` value if simpler. |
| `GITHUB_TOKEN` | PAT with `repo` (read) scope. Drives `lib/monitors/github.ts`. | https://github.com/settings/personal-access-tokens — fine-grained, **Read** access to the repos you've imported, plus `metadata: read`. |
| `VERCEL_TOKEN` | Personal token used by `lib/monitors/deploy.ts`. | https://vercel.com/account/tokens → "Create token". |
| `VERCEL_TEAM_ID` | Required because `pulse-agency` is a team. | Already known: `team_k0SWLUX2RSC5kkFa3WofmYL4`. |
| `CRON_SECRET` | Bearer that the Vercel scheduled cron sends in `Authorization`. Any random string you generate. | `openssl rand -hex 32`. Paste the **same** value into Vercel project settings → Environment Variables. |
| `VERCEL_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/vercel`. | Generate: `openssl rand -hex 32`. We'll register the webhook in step 4. |
| `GITHUB_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/github`. | Generate: `openssl rand -hex 32`. We'll register webhooks in step 5. |
| `DEV_PROJECTS_ROOT` | Directory holding your local repos. **Local only.** Don't add this to Vercel — production has no filesystem access. | Already in `.env.local`. |

After saving, redeploy (the `vercel.json` cron picks up the new env on next deploy). Easiest:

```bash
cd "/Users/christian/Developer/Pulse Tool/apps/dev"
vercel deploy --prod --yes
```

Then re-hit `/api/health` — every monitor should flip from `missing` to `ok`.

### 2. Confirm DB schema is current — 2 min

We added a few queries that lean on existing migrations (`0005_dev_schema.sql`, `0006_dev_indexes.sql`, etc.). Make sure your Supabase project is on the latest migration:

```bash
cd "/Users/christian/Developer/Pulse Tool"
pnpm migrate            # idempotent — re-runs the last migrations
```

If it complains about a missing column, paste the error in chat and I'll write the patch migration.

### 3. Run discovery once — 3 min

We've never imported your existing repos. From the dashboard:

1. Go to https://pulse-dev-two.vercel.app/projects (or click "Projects" in the top bar)
2. Hit **Discover** in the empty state
3. The page will be empty in production because `DEV_PROJECTS_ROOT` only exists locally — that's fine. Run discovery from the CLI instead:

```bash
cd "/Users/christian/Developer/Pulse Tool/apps/dev"
pnpm discover                  # dry-run, prints candidates
pnpm discover --apply          # actually inserts them
```

This walks `~/Developer`, finds every `.git` directory, parses the GitHub remote, and inserts a `dev.projects` row per repo (idempotent — won't duplicate).

After this, the home page will show real cards in "Projects by state" and the activity feed will start filling once monitors run.

### 4. Wire the Vercel deployment webhook — 5 min

This makes deploys appear in the dev hub the second they happen, instead of waiting for the 6-hour cron.

1. https://vercel.com/teams/pulse-agency/settings/webhooks
2. **Create webhook**:
   - URL: `https://pulse-dev-two.vercel.app/api/webhooks/vercel`
   - Secret: paste the same value as `VERCEL_WEBHOOK_SECRET`
   - Events: `deployment.created`, `deployment.succeeded`, `deployment.error`, `deployment.canceled`
   - Projects: select all the projects you care about (or "All projects" — the receiver tolerates unknown projects).
3. Save. Trigger any redeploy and confirm a row appears in `dev.deployments`.

### 5. Wire the GitHub repo webhooks — 5 min per repo (only the ones that matter)

For each repo where you want push/PR events to update the dev hub instantly:

1. `Repo → Settings → Webhooks → Add webhook`
2. Payload URL: `https://pulse-dev-two.vercel.app/api/webhooks/github`
3. Content type: `application/json`
4. Secret: paste the same value as `GITHUB_WEBHOOK_SECRET`
5. Which events: select **Pushes** and **Pull requests** (the receiver only cares about those today; everything else is a no-op).
6. Save. Push something and watch the row update.

You can skip this for repos where the 6-hour cron is fast enough.

### 6. Trigger an end-to-end check — 2 min

```bash
# 1. Manual cron — should return { ok: true, github: {...}, deploy: {...} }
curl -H "Authorization: Bearer $CRON_SECRET" https://pulse-dev-two.vercel.app/api/cron/refresh-monitors

# 2. Health
curl https://pulse-dev-two.vercel.app/api/health
```

Then load https://pulse-dev-two.vercel.app/ — Activity Feed should now have rows, Attention tile should show real numbers, and the Sister Tool card should pull live counts from the social tool's schema.

## Known small things you'll want to nudge later

These are good-but-not-blocking polish items I didn't get to. Cheap to do over coffee:

- **Mobile pass.** The home Command Center stacks fine but the activity-feed two-column grid gets tight under 380px. Project cards and the Kanban view would benefit from larger touch targets. Tracked as `id: mobile` in the todo list.
- **Webhook for `pull_request`** currently re-polls the whole project. If we hit GitHub rate limits, narrow it down to just the PR/issue counts diff.
- **`apps/social/people/`** — there are uncommitted files in the social app (`apps/social/app/people/page.tsx`, `_editor.tsx`) that look in-progress. I left them alone tonight; they're a separate session.
- **`vercel.json` at the monorepo root was deleted** during the deploy refactor (replaced by `apps/dev/vercel.json`). If you have a `pulse-tool` Vercel project that builds the social tool from the repo root, double-check it still works — and if it doesn't, we restore from git.

## How to keep working tonight (or tomorrow morning)

Local dev:

```bash
cd "/Users/christian/Developer/Pulse Tool"
pnpm install                       # if anything's stale
pnpm --filter @pulse/dev dev       # dev server on :3000
```

Production deploy:

```bash
cd "/Users/christian/Developer/Pulse Tool/apps/dev"
vercel deploy --prod --yes
```

Logs:

```bash
vercel inspect https://pulse-dev-two.vercel.app --logs
# or in the UI:
# https://vercel.com/pulse-agency/pulse-dev
```

If something breaks at 7am, check `/api/health` first. It tells you whether the DB is reachable and which secrets are present — 80% of "why isn't this working" questions resolve there.

— Sleep well. The hub will be waiting.
