# Tonight's run sheet — Pulse Production Hub

> Generated 2026-04-27 ~22:50 CT. Target: operational by morning (2026-04-28).
> User read-this-first file lives at `MORNING_BRIEF.md` once tonight's work is shipped.

## What's already live (Phase 2.1, shipped earlier)
- Migration `0004_public_people_and_notifications.sql` applied; `people` and
  `notifications` exist; Trey + Christian seeded.
- Action engine with 6 detectors (stuck post, lead-time tight, missing month plan,
  shoot unassigned, coverage gap, asset overdue) — all unit-tested.
- `/api/cron/regenerate-notifications` upserts by stable `dedup_key`, marks
  vanished conditions resolved.
- Top-bar **Person picker** (localStorage) + **Notification bell** (severity-tinted count).
- `/today` (role-aware) + `/notifications` (full feed, filterable, recompute button).
- Today rail injected at top of `/`.
- `vercel.json` has the daily 13:00 UTC cron.
- Production: https://pulse-tool-mauve.vercel.app

## What ships tonight

### Track A — Anthropic Claude integrations (Phase 2.3)
**Owner:** sub-agent A. **Mode:** ship behind a graceful "no-key-yet" fallback so
the surfaces work even before the user adds `ANTHROPIC_API_KEY`.
- `lib/llm/anthropic.ts` — thin wrapper with prompt caching for the brand-voice system prompt.
- `lib/llm/prompts.ts` — system prompts: caption rewriter, shoot brief, month plan drafter.
- `app/api/llm/caption/route.ts` — single-call rewriter, 3 variants in brand voice.
- `app/api/llm/shoot-brief/route.ts` — pre-shoot brief from frame + capture list + linked posts.
- `app/api/llm/draft-month/route.ts` — streaming month-plan draft (30–50 posts).
- `components/ai-caption-helper.tsx` — modal triggered by an "AI" chip on each post row.
- `components/ai-shoot-brief.tsx` — button on shot list that drops a paragraph in.
- `components/ai-month-drafter.tsx` — modal on planning page when month is empty.
- All AI surfaces use the Pulse design system (cream / green-deep / amber-mid).

### Track B — People management UI + assign-to-person (Phase 2.1 finishing touches)
**Owner:** sub-agent B.
- `/people` page — CRUD for the team roster (name, role, color).
- `components/people-editor.tsx` — same editing aesthetic as `/holidays`.
- Planning grid: assignee picker per shoot card and per post row (FKs already exist).
- Production page: assignee chip on each shoot.
- Mobile capture polish on the shot list: bigger tap targets, sticky action bar.

### Track C — Phase 2.2 detectors + bulk asset reconciliation
**Owner:** sub-agent C (or done inline if quick).
- `detectMonthGenerationDue` — fires 10 days before month-end if next month is empty.
- `detectShootScheduleConflict` — same person, same time slot.
- `detectRideAlongOpportunity` — Pulse posts unbundled within 14d of a client shoot.
- `detectQuotaShortfall` — quotas trailing the calendar.
- Shot list: "Mark all required captured" sweep.
- Shoot card: bulk-paste Drive URLs → auto-add as extras.

### Track D — Design polish (lead from main thread)
- Audit every page against the Pulse design system. Surface missing eyebrows,
  loose grain texture on dark sections, italic-amber reframes on H2 headers, etc.
- Fix any squished UI (Council surfaced this; some shoot cards still tight).
- Mobile audit on shot list + planning grid (the field-touch pages).

## Coordination

Sub-agents work in **isolated worktrees** so they can't step on each other.
After each agent completes, I read the diff, integrate cleanly into main, and
run tests + build at integration points.

## Verification before bed
1. `pnpm test` — all suites (action engine, computations, any new) pass.
2. `pnpm build` from monorepo root via `pnpm --filter @pulse/social build`.
3. `vercel deploy --prod --yes` from repo root.
4. Smoke routes: `/`, `/today`, `/notifications`, `/people`, `/clients/onsc/months/2026-05/planning`.
5. Cron route returns `{ok:true}` and creates fresh notifications.

## What the user has to do in the morning
Captured in `MORNING_BRIEF.md`. Top items:
- Drop `ANTHROPIC_API_KEY` into Vercel project envs (we set up envs on the project from the CLI).
- Set `CRON_SECRET` so the daily cron job is authed (we wire that in tonight).
- Optional but recommended: Vercel password protection for the no-auth posture.
