# Pulse Production Hub — morning brief

**Generated:** 2026-04-28, ~07:30 CT
**Read this first.** It tells you (a) exactly what's live, (b) what didn't ship and why, (c) the small hands-on steps to fully activate.

---

## TL;DR

The dashboard you went to bed with **is still live and working** at https://pulse-tool-mauve.vercel.app. Phase 2.1 (role-aware Today view, in-app notifications, action engine, daily cron) shipped earlier yesterday. **Phase 2.2 and 2.3 (more detectors, Anthropic Claude integrations, full design polish) did not ship overnight** — the three sub-agents dispatched all hit your **Anthropic org's monthly token limit** mid-task and were terminated by the platform. One agent did get the `/people` page in before it hit the wall; that's now wired into the nav and live.

**You have one essential 60-second task** before the planning workflow is fully usable:
- Open https://pulse-tool-mauve.vercel.app, click the person picker in the top bar (top-left, beside the brand mark), pick yourself. The role-aware "Today" view doesn't show until someone is selected — by design.

Everything else below is optional polish or "wait until org limits reset" work.

---

## What's live right now

### URL
- **Production:** https://pulse-tool-mauve.vercel.app
- **Vercel project:** `pulse-agency/pulse-tool` (monorepo deploy from repo root, root dir `apps/social`)
- **Database:** Supabase project `boptkjyjcfulysnlfvfu`. Migrations 0001–0004 all applied.

### Pages
| Route | What it does |
|---|---|
| `/` | Production hub — pipeline strip, field schedule (next 14 days, co-located shoot detection), Pulse house lane, attention cards, per-client overview, Today rail at top once you've signed in. |
| `/today` | Role-aware. Tells you what to do today, what's coming this week, and what the team's working on that touches you. Empty state prompts the picker if nobody's signed in. |
| `/notifications` | Full feed. Filterable by audience (Mine vs Everyone), state (Open/All), severity, client. Dismiss-one and Dismiss-all built in. |
| `/clients` | Client roster + add new client. |
| `/clients/onsc` | ONSC overview with month list. |
| `/clients/onsc/months/2026-05/planning` | The 44-post May plan you imported earlier, status pipeline visible per row, asset-URL inline edit. |
| `/clients/onsc/months/2026-05/production` | Shoot schedule, coverage gaps, validation gates. |
| `/clients/onsc/months/2026-05/calendar` | Month grid. |
| `/clients/onsc/months/2026-05/shoots/N/shotlist` | Per-shoot capture checklist (required + extras lanes). |
| `/people` | **New.** Add/edit team members. Currently just Trey + Christian seeded by the migration. |
| `/holidays` | Global holidays (19 seeded from your spreadsheet). |
| `/shoot-templates` | The 7 shoot types from your template. |

### What's actually wired and operational
- **Role-aware Today view** — pick yourself in the top bar, the page reorganizes around your role.
- **Notifications dashboard** with a top-bar bell (severity-tinted unread count).
- **Action engine** with 6 detectors running daily at 8am CT via Vercel cron:
  1. Stuck posts (planned, due this week, has a shoot)
  2. Lead time tight (post too close to its shoot)
  3. Missing month plan (next month is empty + close)
  4. Shoot unassigned (next 7 days, no person assigned)
  5. Coverage gap (back half of month, content type below quota)
  6. Asset overdue (captured post nearing go-live with no asset URL)
- **Manual recompute** — "Recompute now" button on `/notifications` runs the engine on demand. (Was an HTTP call that 401'd against the cron auth; rewrote it as a Server Action so it works in prod.)
- **Pulse-as-its-own-client** — Pulse Community Agency is a real client row. Plan its own posts; piggyback its shoots onto client outings.
- **Asset URL field** on every post — paste a Drive link, the post's status auto-advances to Edited.
- **Capture checklist** with Required + Extras lanes, ride-along (piggyback) shoots.

### Cron auth
- `CRON_SECRET` is set in Vercel for production (a secret generated tonight is also stored at `/tmp/pulse-cron-secret.txt` on this machine in case you want to view it).
- Vercel's daily 13:00-UTC cron job sends `Authorization: Bearer ${CRON_SECRET}` and the route validates it. Direct unauthorized hits to the endpoint now return 401.
- If you ever want to rotate the secret, regenerate one in Vercel project settings → Environment Variables, and the cron job will pick up the new value on next run.

---

## What didn't ship (and what to do about it)

I dispatched three sub-agents in parallel last night to ship Phase 2.2 and 2.3 in a single push. **All three hit your Anthropic org's monthly token limit** roughly 1.5 minutes in. The platform terminated them.

| Track | What was supposed to ship | Status |
|---|---|---|
| **A — Anthropic Claude** | `lib/llm/anthropic.ts` wrapper, caption helper, shoot-brief, AI month-plan drafter | **Did not ship.** No files written. |
| **B — People mgmt + assignee UI** | `/people` page + assignee pickers in planning grid + production page + mobile polish | **Partially shipped.** `/people` page itself landed and is live. The assignee picker on shoots and the mobile polish on the shot list **did not** land. |
| **C — Phase 2.2 detectors + bulk actions** | 4 new detectors, "Mark all required captured", bulk-paste Drive URLs | **Did not ship.** No files written. |

The agents themselves haven't introduced any half-broken code into your repo — `git status` is clean for `apps/social/` aside from the `/people` page (Track B) and a single `notifications-feed.tsx` + `actions.ts` improvement I made manually (the recompute-button fix).

### To get Tracks A and C done

Wait for your Anthropic org limit to reset (usually first of the month, or upgrade your plan), then send me this exact message:

> Resume Phase 2.2 + 2.3 from `TONIGHT.md`. Re-dispatch Tracks A and C. Track B is mostly done — finish the assignee picker and mobile polish.

I'll re-fire the agents from where they stopped. The full plan is preserved at `/Users/christian/.claude/plans/users-christian-downloads-pulse-social-typed-spindle.md` and the run sheet at `TONIGHT.md`.

### To finish Track B yourself if you can't wait

Two small tasks remain:

1. **Wire the assignee picker into shoot cards** in `apps/social/components/planning-grid.tsx`. Replace the existing freeform `assigned_to` text input with a `<select>` populated from the `people` table. The server action `assignShootToPerson` already exists in `lib/actions.ts`. Pass `people: Person[]` from the planning page (`apps/social/app/clients/[slug]/months/[month]/planning/page.tsx`) — it already calls `listPeople()` indirectly through the shell, but you'll need to load it explicitly there.

2. **Mobile polish on the shot list checklist** (`apps/social/app/clients/[slug]/months/[month]/shoots/[n]/shotlist/_checklist.tsx`):
   - Bump checkbox tap target: change `h-6 w-6` to `h-9 w-9 md:h-7 md:w-7`.
   - "Add extra" form: change `flex flex-wrap items-center gap-2` to `flex flex-col gap-2 md:flex-row md:items-center`.

---

## Configuration to add when you're ready

### 1. Anthropic API key (required for Phase 2.3 once it ships)

When Phase 2.3 lands, the AI features will check for `ANTHROPIC_API_KEY` and gracefully fall back to a "Add the key" empty state if it's missing. To activate them:

1. Get a key at https://console.anthropic.com/settings/keys.
2. Add it in Vercel: **Project Settings → Environment Variables → Add → `ANTHROPIC_API_KEY`** (Production + Preview + Development).
3. Redeploy (or wait for the next deploy).

### 2. (Optional) Vercel password protection

You're running with **no auth** (correct for v1). Anyone with the URL can read and write everything. Two options:

- **Vercel Password Protection** (free with team plan): Project Settings → Deployment Protection → enable Password Protection. Anyone visiting the URL hits a Vercel-hosted password gate.
- **Skip if you'd rather just keep the URL private** for now.

### 3. (Optional) Vercel Speed Insights

Already provisioned on the project. No action needed unless you want the dashboard.

---

## Smoke tests to run yourself (60 seconds)

Open https://pulse-tool-mauve.vercel.app and:

1. **Top-bar person picker** — click it, pick "Christian" or "Trey." It should persist on reload (localStorage).
2. **`/today`** — should show your role-aware view. If "Christian" picked, you'll see strategy items; if "Trey" picked, field-related items.
3. **`/notifications`** — click "Recompute now." You should see "Refreshed. N active · M cleared." Within 2 seconds.
4. **`/people`** — click "+ Add person", type a name, pick a role. It should appear in the list immediately.
5. **`/clients/onsc/months/2026-05/planning`** — click the "AI" caption chip on any post (this will be added in Phase 2.3 — currently does nothing visible). Skip until 2.3 ships.
6. **`/clients/onsc/months/2026-05/production`** — confirm the May 2026 ONSC plan shows 4 shoots and the validation gates strip.

If any of those return 500 or look broken, send me the URL + a screenshot.

---

## Files I'd want you to look at if you have 5 minutes

- `TONIGHT.md` — the plan I executed against last night
- `/Users/christian/.claude/plans/users-christian-downloads-pulse-social-typed-spindle.md` — the longer Phase 2 roadmap
- `apps/social/lib/action-engine.ts` — the detector logic that runs daily; this is the heart of the "tell me what's stuck" surface
- `apps/social/components/today-board.tsx` — the role-aware Today view
- `apps/social/app/people/page.tsx` + `_editor.tsx` — what Agent B got in before the org limit hit

---

## What I'm honestly disappointed about

You asked for an operational tool by morning. Phase 2.1 *is* fully operational, but I owed you 2.2 + 2.3 and didn't get them in because the agent dispatch hit your org's token ceiling. A more careful version of me would have run the agents sequentially instead of in parallel, or chunked the AI integrations into smaller passes. I committed to the plan and the plan was bigger than the budget.

Two upsides:
1. Nothing's broken. The dashboard you had at bedtime is intact and slightly improved (recompute button now works in prod, `/people` is live).
2. The plan and run sheet for the rest are precise. When the limit resets, this is a "press play" remainder, not a re-think.

Whenever you're ready, send the resume message above.
