# Entity Ownership

The canonical contract for which Pulse tool owns which database entity.
**Update this file when a new tool is added or when an entity gets a new reader.**

## Rules

1. **One owner per entity.** Exactly one app writes (insert/update/delete). Other apps read only.
2. **Cross-schema FKs are forbidden.** If a row in `dev.*` needs to reference a row in `public.*`, store the linked entity's `slug` (or another natural key) as `text`. This keeps each app's migrations independent — a tool can rename a column without breaking another tool.
3. **Schema = ownership.** `public.*` is owned by `@pulse/social`. `dev.*` is owned by `@pulse/dev`. New tools get new schemas.
4. **Read access does not require code.** Cross-tool reads happen by constructing a Supabase client targeting the other schema (`supabaseServer({ schema: 'public' })` from the dev hub). No special export or shared package is required.

## Current ownership

| Entity              | Schema | Owner (writes)  | Readers          | Notes |
|---------------------|--------|-----------------|------------------|-------|
| `clients`           | public | `@pulse/social` | `@pulse/dev` ro  | Dev hub may *reference* a client on a project via slug; never insert/update. |
| `strategic_frames`  | public | `@pulse/social` | —                | Tool-internal. |
| `content_quotas`    | public | `@pulse/social` | —                | Tool-internal. |
| `shoot_templates`   | public | `@pulse/social` | —                | Tool-internal. |
| `holidays`          | public | `@pulse/social` | —                | Tool-internal. |
| `months`            | public | `@pulse/social` | —                | Tool-internal. |
| `shoots`            | public | `@pulse/social` | —                | Tool-internal. |
| `posts`             | public | `@pulse/social` | —                | Tool-internal. |
| `assets`            | public | `@pulse/social` | —                | Tool-internal. |
| `capture_items`     | public | `@pulse/social` | —                | Tool-internal. |
| `projects`          | dev    | `@pulse/dev`    | `@pulse/social`* | Social may surface a linked dev project on a content shoot, but never writes. (*read access not yet wired in v1.) |
| `tasks`             | dev    | `@pulse/dev`    | —                | Tool-internal. |
| `repo_activity`     | dev    | `@pulse/dev`    | —                | Tool-internal monitoring snapshot. |
| `fs_snapshots`      | dev    | `@pulse/dev`    | —                | Tool-internal monitoring snapshot. |
| `deployments`       | dev    | `@pulse/dev`    | —                | Tool-internal monitoring snapshot. |
| `_migrations`       | public | (infrastructure) | (infrastructure) | Bookkeeping for `pnpm migrate`. |

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
