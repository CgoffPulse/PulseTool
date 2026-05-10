# Entity Ownership

The canonical contract for which Pulse tool owns which database entity.
**Update this file when a new tool is added or when an entity gets a new reader.**

## Rules

1. **One owner per entity.** Exactly one app writes (insert/update/delete). Other apps read only.
2. **Cross-schema FKs are forbidden.** If a row in `dev.*` needs to reference a row in `public.*`, store the linked entity's `slug` (or another natural key) as `text`. This keeps each app's migrations independent — a tool can rename a column without breaking another tool.
3. **Schema = ownership.** `public.*` is owned by `@pulse/social`. `dev.*` is owned by `@pulse/dev`. New tools get new schemas.
4. **Read access does not require code.** Cross-tool reads happen by constructing a Supabase client targeting the other schema (`supabaseServer({ schema: 'public' })` from the dev hub). No special export or shared package is required.

## Current ownership

| Entity                    | Schema  | Owner (writes)   | Readers          | Notes |
|---------------------------|---------|------------------|------------------|-------|
| `clients`                 | public  | `@pulse/social`  | `@pulse/huddle`, `@pulse/dev`, `@pulse/crm` ro | Other tools may *reference* a client via slug or id; never insert/update. |
| `clients.tier`            | public  | `@pulse/social`  | all ro           | Added in 0012. Drives onboarding cascade defaults; ONSC anchored to `premium`. |
| `clients.service_lines`   | public  | `@pulse/social`  | all ro           | Added in 0012. Defaults to `{content}`. Per-engagement service-line keys reference `public.service_lines.key`. |
| `strategic_frames`        | public  | `@pulse/social`  | —                | Tool-internal. |
| `content_quotas`          | public  | `@pulse/social`  | —                | Tool-internal. |
| `shoot_templates`         | public  | `@pulse/social`  | —                | Tool-internal. |
| `holidays`                | public  | `@pulse/social`  | —                | Tool-internal. |
| `months`                  | public  | `@pulse/social`  | —                | Tool-internal. |
| `shoots`                  | public  | `@pulse/social`  | —                | Tool-internal. |
| `posts`                   | public  | `@pulse/social`  | —                | Tool-internal. |
| `assets`                  | public  | `@pulse/social`  | —                | Tool-internal. |
| `capture_items`           | public  | `@pulse/social`  | —                | Tool-internal. |
| `people`                  | public  | `@pulse/social`  | all ro           | Slug-soft `assigned_person_id` columns across `command.*` reference `public.people.id`. |
| `recurring_expectations`  | public  | `@pulse/social`  | —                | Tool-internal (admin command center). |
| `expectation_completions` | public  | `@pulse/social`  | —                | Tool-internal (admin command center). |
| `service_lines`           | public  | (infra/seed)     | all ro           | Lookup table seeded in 0012. Read-only at runtime; updates ship as migrations. |
| `projects`                | dev     | `@pulse/dev`*    | `@pulse/huddle`  | **Superseded by `command.projects` (see 0011 backfill).** During v1 transition, `apps/dev` continues reading/writing `dev.projects`. Cutover in a follow-up session. New code should write to `command.projects`. |
| `tasks`                   | dev     | `@pulse/dev`*    | `@pulse/huddle`  | **Superseded by `command.tasks` (see 0011 backfill).** Same transition rule as `dev.projects`. |
| `repo_activity`           | dev     | `@pulse/dev`     | —                | Tool-internal monitoring snapshot. |
| `fs_snapshots`            | dev     | `@pulse/dev`     | —                | Tool-internal monitoring snapshot. |
| `deployments`             | dev     | `@pulse/dev`     | —                | Tool-internal monitoring snapshot. |
| `command.departments`     | command | (infra/seed)     | all ro           | Seeded in 0011 (content / account / analytics / brand / engineering / ops). Read-only at runtime. |
| `command.projects`        | command | `@pulse/huddle`  | all ro           | The unified agency project model. Backfilled from `dev.projects` preserving UUIDs. Slug-soft references to `public.clients.id`, `public.people.id`, `public.service_lines.key`. |
| `command.tasks`           | command | `@pulse/huddle`  | all ro           | The unified agency task model. Auto-created by `@pulse/voice` signal-ingest cron via `signal_key` idempotency. Backfilled from `dev.tasks` preserving UUIDs. |
| `command.signals`         | command | `@pulse/voice`   | `@pulse/huddle` ro | **Dual writer:** `@pulse/huddle` UI may insert manual signals; `@pulse/voice`'s signals-ingest cron is the primary writer (consumes the action engine + cross-app event streams). Append-only; processed-state machine. |
| `command.approvals`       | command | `@pulse/huddle`  | `@pulse/social` ro | Artifact-keyed approval state. `@pulse/social` reads to gate post / brief publication; `@pulse/huddle` is the only writer. |
| `command.client_users`    | command | `@pulse/huddle`  | —                | Per-client portal logins (magic-link). |
| `command.portal_tokens`   | command | `@pulse/huddle`  | —                | Single-use signed-URL grants. Append-only with a `consumed_at` flip. |
| `command.followups`       | command | `@pulse/huddle`  | `@pulse/crm` ro  | **Dual-writer transition:** `@pulse/crm` migrates its existing `crm-followups` cron writer here over time; meanwhile `@pulse/huddle` is the canonical writer for the new follow-up kinds (`shoot.post`, `retainer.renewal`, `approval.chase`, `onboarding.check_in`). |
| `_migrations`             | public  | (infrastructure) | (infrastructure) | Bookkeeping for `pnpm migrate`. |

\* `@pulse/dev` retains write access to `dev.projects` / `dev.tasks` only during the v1 transition. New writes belong in `command.*`.

## Linking entities across tools

When the dev hub starts referencing a content client, store it as a slug:

```sql
-- dev.projects.client_slug text references the social tool's clients.slug.
-- Not an FK — kept loose on purpose (see rule #2).
alter table dev.projects add column client_slug text;
```

The dev hub then resolves that slug at read time:

```ts
const social = supabaseServer({ schema: 'public' });
const { data: client } = await social.from('clients').select('*').eq('slug', project.client_slug).maybeSingle();
```

The social tool MUST NOT add an FK to `dev.projects` — same rule applies in reverse.

### Command-schema slug-soft references

The `command.*` tables make extensive use of slug-soft cross-schema pointers:

- `command.projects.client_id` and `command.tasks.client_id` are uuid pointers
  to the `clients` table id (in the public schema) — but with NO foreign key.
  `client_slug` is denormalized alongside so a cross-schema read is not
  required for the common case.
- `command.projects.assigned_person_id` and `command.tasks.assigned_person_id`
  are uuid pointers to the people table id (in the public schema) — again, NO
  foreign key.
- `command.projects.service_line` is a text pointer to
  `public.service_lines.key` — also slug-soft.
- `command.client_users.client_id` is a uuid pointer to the clients table id
  (in the public schema). No FK.

The same rule applies in reverse: the social tool MUST NOT add a foreign key
to any `command.*` table. Cross-schema reads use a Supabase client targeting
the other schema (`supabaseServer({ schema: 'command' })`).
