# Pulse Agency Suite — Morning Brief

Tonight's work shipped four new standalone apps in the monorepo, each on its
own Vercel project, each writing to its own Postgres schema, each rendered
in the Pulse design system (cream / green-deep / amber-mid, Playfair +
Montserrat, grain overlays, italic-amber accents). Every app is reachable,
every health endpoint reports `db: ok`, every page returns 200.

## Live URLs

| App         | URL                                          | Schema      | Vercel project   |
|-------------|----------------------------------------------|-------------|------------------|
| Pulse CRM   | https://pulse-crm-silk.vercel.app            | `crm`       | `pulse-crm`      |
| Pulse Voice | https://pulse-voice-rho.vercel.app           | `voice`     | `pulse-voice`    |
| Pulse Analytics | https://pulse-analytics-eight.vercel.app | `analytics` | `pulse-analytics`|
| Pulse Huddle | https://pulse-huddle.vercel.app             | (read-only) | `pulse-huddle`   |

The dashboard at `https://pulse-huddle.vercel.app` is the single screen
that pulls everything together.

## What each app does

### CRM (`apps/crm`)
- Pipeline kanban across 6 stages (new → qualified → proposal → negotiation → won / lost)
- KPI strip: new this month, won this month, lost this month, pipeline value, won MTD
- Stalled-leads sweep (no touch in 7+ days)
- Lead detail with timeline of touches + stage events, "Promote to client" bridge
- Inbox of follow-ups due today
- Reports: funnel, win rate by source, avg days to close, lost reasons
- Settings for sources & lost reasons (CRUD)
- **Cron**: `/api/cron/crm-followups` daily at 13:00 UTC writes stalled leads as cross-tool notifications

### Voice (`apps/voice`)
- Library hub: brand briefs per client, prompt templates, recent runs
- Brand brief markdown editor (versioned — every save creates a new row)
- Templates editor + 7 seed templates pre-loaded (post-caption, shoot-brief,
  sales-email, analytics-insight, analytics-recommendation, analytics-tag-post,
  analytics-chart-pick)
- Playground for trying any template against a client's brief + glossary
- Glossary settings (banned/preferred phrases, per-client or global)
- Service-token issuer for cross-app authentication
- **Gateway endpoints** that other apps call:
  - `POST /api/llm/run` — runs any template; returns text
  - `POST /api/llm/structured` — runs any template into a typed schema
  - Bearer-auth via `voice.service_tokens` (or the `VOICE_GATEWAY_INTERNAL_TOKEN` env)
  - Every call logged to `voice.runs` with input, output, model, tokens, cost
- **Graceful no-key fallback**: without `ANTHROPIC_API_KEY`, calls return a
  documented `[stub]` response and log `status='stub'`

### Analytics (`apps/analytics`) — AI-native
- Agency overview: stats strip, latest cross-client insight (markdown),
  top-10 leaderboard, anomaly cards
- Per-client pages with sparklines (followers / reach / engagement),
  GA4 strip, **Advisor recommendations queue** (Accept / Dismiss with reason)
- Posts matrix joining planned posts → ingested external posts via `post_match`
- "Ask the data" page with AI auto-visualization (calls Voice gateway,
  returns typed chart spec, renders inline; pin-to-saved charts)
- Integrations page (Meta OAuth, GA4 property paste)
- CSV import for IG/FB historical data
- **Crons**:
  - `/api/cron/ingest-meta` — every 6h
  - `/api/cron/ingest-ga4` — every 6h
  - `/api/cron/generate-insights` — daily 13:30 UTC
  - `/api/cron/generate-recommendations` — daily 14:00 UTC
- All AI surfaces gracefully fall back to realistic stubs when integration
  keys are missing

### Huddle (`apps/huddle`) — agency command bridge
- Single-screen dashboard with five lanes: **Money** (CRM), **Content**
  (social), **Code** (dev hub), **Brand** (Voice), **Performance**
  (Analytics), plus a **People** capacity heuristic
- Sister-tool launcher cards
- Health pings of every sibling app shown as colored dots in the footer
- `/morning` diff feed: "what's changed across every tool since…" with last-viewed
  timestamp stored in localStorage and Last hour / 24h / 7d preset chips
- Read-only — never writes to any schema; one tool failing shows an empty
  state instead of cascading

## Database — already migrated

All schemas are live in the same Supabase Postgres pool:

```
0006_crm_init.sql           applied  — crm.*
0007_voice_init.sql         applied  — voice.* (+ 7 seed templates)
0008_analytics_init.sql     applied  — analytics.*
```

Schema-isolation linter (`packages/db/scripts/check-migration-isolation.ts`)
was extended to know about `crm`, `voice`, and `analytics`.

## What you need to do this morning (in order)

### 1. Anthropic API key (15s) — unlocks every AI surface

```bash
cd "apps/voice"
printf 'sk-ant-...your-key...' | vercel env add ANTHROPIC_API_KEY production --force
vercel deploy --prod --yes
```

Once that lands, every `[stub]` becomes a real Sonnet call. Analytics
recommendations and insights become live, the playground works, etc.

### 2. (When ready) Pulse Social URL — relinks footers + huddle

Tonight I removed the wrong fallback URL (`pulse-tool-mauve.vercel.app`,
which is a different project). When `apps/social` has its own deploy,
push its production URL to every consumer:

```bash
SOCIAL_URL='https://...the-real-pulse-social-url...'
for app in apps/crm apps/voice apps/analytics apps/huddle; do
  cd "$app"
  printf '%s' "$SOCIAL_URL" | vercel env add NEXT_PUBLIC_SOCIAL_URL production --force
  vercel deploy --prod --yes
  cd -
done
```

The huddle's social-tool launcher card will light up, and the CRM's
"Promote to client" button will deep-link into the social tool.

### 3. (Optional) Cross-tool secrets

```bash
# CRM cron auth
cd apps/crm && printf 'random-string-here' | vercel env add CRON_SECRET production --force

# Public app URLs CRM uses to build click-through link_urls in notifications
printf 'https://pulse-crm-silk.vercel.app' | vercel env add NEXT_PUBLIC_CRM_URL production --force
```

### 4. (Later) Meta + GA4 ingest for live analytics

Until these are set, ingest crons return `{ ok: true, skipped: true }` —
no errors, just no fresh data.

```
META_APP_ID
META_APP_SECRET
META_REDIRECT_URI=https://pulse-analytics-eight.vercel.app/api/integrations/meta/callback
GA4_SERVICE_ACCOUNT_B64
```

For Meta you'll need to register an app at developers.facebook.com,
add Meta Login + Instagram Business products, paste the IDs above, and
add the redirect URI to the app's Valid OAuth Redirect URIs.

For GA4 you'll need a GCP service account with the GA4 Data API enabled
and `Viewer` role on each Property; base64-encode the JSON and paste.

### 5. Voice gateway service tokens (already done)

A bootstrap service token was minted and pushed into Analytics so the
`/api/llm/run` calls work. If you ever need to mint another one (for the
social app, for the dev hub, for a future tool):

- Open https://pulse-voice-rho.vercel.app/settings/service-tokens
- Issue a new token (the unhashed value is shown ONCE in a banner)
- Paste it into the consuming app's Vercel env as `VOICE_GATEWAY_TOKEN`

## Architecture conventions (so future tools follow the same recipe)

Every app in `apps/*` is now built the same way:

- Standalone deploy, no workspace deps. `next.config.ts` guards
  `outputFileTracingRoot`/`turbopack.root` behind `!process.env.VERCEL`.
- `tsconfig.json` does not extend the monorepo base.
- Per-tool schema in Postgres. New schemas go in
  `packages/db/migrations/00NN_<schema>_<name>.sql` and the linter enforces
  one-schema-per-migration.
- Pulse design tokens duplicated, not extracted (yet). When we go for the
  unified Pulse Suite (Phase 5), these get extracted into `@pulse/ui`.
- Every app ships `/api/health` returning `{ ok, app, db, integrations }`.
- Cross-tool reads use light helper functions that wrap try/catch so a
  schema being unavailable returns `null`/`[]` instead of crashing.
- Cross-tool writes go through `notifications` (the social tool's
  in-app bell) using a `dedup_key` for idempotency.

## What's deliberately deferred (Phase 5 and beyond)

These were not started tonight and are real multi-week projects:

- **Unified Pulse Suite**: extract `@pulse/ui`, single shared auth (Clerk
  or similar), mount each module under one app shell.
- **Obsidian knowledge-base integration**: Obsidian as the source of
  truth for SOPs, brand voice, and project notes; sync into the relevant
  schemas.
- **Finance / invoicing / retainers** (Stripe + a ledger model).
- **Client portal** (depends on auth/RBAC).
- **Publishing automation** (Meta Graph write-side).
- **Time tracking**.

## Known small polish items (low priority)

- Voice playground renders results inline — not streaming. Anthropic
  streaming would need a `ReadableStream` route. Fast enough on Sonnet
  that it doesn't feel slow.
- Voice glossary supports add/delete but not in-place edit.
- Analytics `post_match` rows aren't auto-populated yet — the matrix view
  honors them, but until a heuristic matcher cron ships, planned posts
  show as `Unmatched`. Manual matching is straightforward to add when
  there's data to test against.
- Analytics' Recharts wasn't installed; the Ask page uses an SVG renderer
  that handles line/bar/table. Add Recharts if scatter plots become
  important.
- Voice's `/api/llm/structured` recommendation schema returns
  `{ recommendations: [...] }` (not a top-level array) because Anthropic's
  tool API requires `type: "object"` at the schema root. Callers should
  read `data.recommendations`.

## How to keep working

- Every app has `pnpm dev` on its own port (3002 CRM, 3003 Voice, 3004
  Analytics, 3005 Huddle, 3001 Dev, 3000 Social).
- The huddle reads from every schema with try/catch wrappers — when the
  social tool comes online or any other schema lights up, the lanes
  automatically populate.
- New schemas go in `packages/db/migrations` and `pnpm migrate` from the
  repo root applies them. The schema-isolation linter will block
  cross-schema work unless you explicitly opt in via filename.

That's the night. Sleep well — when you wake up, paste the Anthropic
key in and the AI brain comes online.
