# Pulse

The agency operating engine. One Next.js app, one deploy, one nav — covering everything from morning brief through brand voice, CRM, analytics, and internal tools.

## What's here

This is the consolidated Pulse app. Six former apps (`huddle`, `social`, `voice`, `crm`, `analytics`, `dev`) were merged into this single Next.js workspace during the Wave 0–2 consolidation.

Route groups under `app/` keep the boundaries readable without splitting deploys:

- `(command)` — Today, Projects, Tasks, Calendar, People, Clients, Approvals
- `(social)` — Workbench, Notifications, Holidays, Shoot templates, Admin
- `(voice)` — Library hub, Templates, Briefs, Playground, Runs, Glossary, Service tokens
- `(crm)` — Pipeline, Inbox, Reports, Sources, Lost reasons
- `(analytics)` — Agency overview, Recommendations, Integrations, Import, Settings
- `(dev)` — Dev home, Monitors, Discover

All cross-cutting code lives in `lib/<domain>/`. One set of env vars, one Supabase project, one nav. The unified top bar surfaces the 7 primary command routes with a departmental "More" dropdown for the rest.

## Develop

From the repo root:

```
pnpm dev                  # runs @pulse/pulse on :3000
pnpm test                 # vitest, 57 tests
pnpm build                # builds every workspace
```

Or scoped:

```
pnpm --filter @pulse/pulse dev
pnpm --filter @pulse/pulse build
pnpm --filter @pulse/pulse test
```

## Deploy

Single Vercel project pointed at `apps/pulse`. All 12 scheduled jobs are registered in `apps/pulse/vercel.json` — regenerate-notifications, crm-followups, refresh-monitors, ingest-meta, ingest-ga4, generate-insights, generate-recommendations, tag-posts, signals-ingest, signals-auto-close, digest-weekly, digest-monthly-client.

## Legacy directories

`apps/{huddle,social,voice,crm,analytics,dev}/` still exist on disk for safe rollback. They are not deployed and not referenced by the root scripts. Once the consolidated deploy is verified in production, those directories will be removed in a follow-up commit.
