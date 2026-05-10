-- 0011_cross_command_dev_schema_init.sql
-- @cross-schema: backfills dev.projects + dev.tasks rows into the new
--   command.* schema (preserving UUIDs) so /projects/[slug] URLs remain
--   stable through the dev → command cutover. apps/dev keeps reading and
--   writing dev.* until a follow-up session migrates it to command.*.
-- Pulse Command — top-level agency operating engine.
-- Promotes dev.projects/dev.tasks into a richer command.* model that any team
-- (engineering, content, account, ops) writes against. Adds command.signals
-- (append-only event log driving auto-task creation) and command.approvals
-- (the artifact-keyed approval state machine surfaced on Christian's queue).
-- Backfills existing dev.projects + dev.tasks rows preserving UUIDs so
-- /projects/[slug] URLs keep working through the cutover.
-- All cross-schema references (clients, people, service_lines) are slug-soft
-- text/uuid columns with NO foreign keys — see ENTITY_OWNERSHIP.md.

create schema if not exists command;

-- ============================================================================
-- Enums
-- ============================================================================

create type command.work_kind as enum (
  'client_campaign',
  'internal_build',
  'ops_initiative',
  'engagement',
  'ad_hoc'
);

create type command.work_state as enum (
  'idea',
  'active',
  'paused',
  'shipped',
  'archived'
);

create type command.task_status as enum (
  'backlog',
  'next',
  'in_progress',
  'blocked',
  'done',
  'cancelled'
);

create type command.task_priority as enum (
  'p0',
  'p1',
  'p2',
  'p3'
);

create type command.task_origin as enum (
  'manual',
  'signal',
  'onboarding',
  'recap',
  'ai_observed',
  'followup'
);

create type command.signal_state as enum (
  'unprocessed',
  'processed',
  'ignored'
);

create type command.approval_state as enum (
  'pending',
  'approved',
  'changes_requested',
  'cancelled'
);

-- ============================================================================
-- Departments — first-class organizational units. Seeded inline.
-- ============================================================================

create table command.departments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  color text,
  sort_index int not null default 0,
  created_at timestamptz not null default now()
);

insert into command.departments (key, name, color, sort_index) values
  ('content',     'Content',     '#3a6a3f', 1),
  ('account',     'Account',     '#8a6d3b', 2),
  ('analytics',   'Analytics',   '#1f6f8b', 3),
  ('brand',       'Brand',       '#a64b2a', 4),
  ('engineering', 'Engineering', '#4a4a4a', 5),
  ('ops',         'Ops',         '#5a5a5a', 6)
on conflict (key) do nothing;

-- ============================================================================
-- Projects — superset of dev.projects. Cross-schema soft references kept loose.
-- ============================================================================

create table command.projects (
  id uuid primary key default gen_random_uuid(),
  kind command.work_kind not null default 'ad_hoc',
  slug text not null unique,
  name text not null,
  state command.work_state not null default 'idea',
  summary text,
  current_focus text,
  -- Slug-soft references; NO foreign keys (see ENTITY_OWNERSHIP.md).
  client_id uuid,
  client_slug text,
  service_line text,
  department_id uuid references command.departments(id) on delete set null,
  assigned_person_id uuid,
  priority command.task_priority not null default 'p2',
  target_ship_date date,
  -- Engineering-project fields preserved from dev.projects.
  github_repo text,
  local_path text,
  vercel_project_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Tasks — superset of dev.tasks with assignment + signal/artifact metadata.
-- ============================================================================

create table command.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references command.projects(id) on delete set null,
  title text not null,
  notes text,
  status command.task_status not null default 'backlog',
  priority command.task_priority not null default 'p2',
  due_date date,
  done_at timestamptz,
  -- Slug-soft references; NO foreign keys.
  assigned_person_id uuid,
  client_id uuid,
  client_slug text,
  origin command.task_origin not null default 'manual',
  -- Idempotency key for auto-created tasks (e.g. 'stuck_post:<post_id>').
  signal_key text,
  -- Optional pointer to the source artifact (post, shoot, deploy, etc.).
  artifact_url text,
  artifact_kind text,
  artifact_id uuid,
  -- Predicate name evaluated by the auto-close cron (e.g. 'post.captured_or_posted').
  auto_close_rule text,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Signals — append-only event log that drives auto-task creation.
-- Sources: 'social','crm','dev','voice','analytics','huddle'.
-- ============================================================================

create table command.signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  dedup_key text not null unique,
  state command.signal_state not null default 'unprocessed',
  task_id uuid references command.tasks(id) on delete set null,
  observed_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ============================================================================
-- Approvals — artifact-keyed sign-off state machine.
-- ============================================================================

create table command.approvals (
  id uuid primary key default gen_random_uuid(),
  artifact_kind text not null,
  artifact_id uuid not null,
  artifact_slug text,
  client_id uuid,
  required_approvers text[] not null default '{christian}',
  -- Each entry: {approver:text, at:timestamptz, status:text, note:text}
  received jsonb not null default '[]'::jsonb,
  state command.approval_state not null default 'pending',
  requested_by_person_id uuid,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index command_tasks_status_due_idx
  on command.tasks (status, due_date);

create index command_tasks_assigned_idx
  on command.tasks (assigned_person_id, status)
  where assigned_person_id is not null;

create index command_tasks_client_idx
  on command.tasks (client_id, status)
  where client_id is not null;

create index command_tasks_project_idx
  on command.tasks (project_id, sort_index);

create unique index command_tasks_signal_idx
  on command.tasks (signal_key)
  where signal_key is not null;

create index command_projects_state_kind_idx
  on command.projects (state, kind);

create index command_projects_client_idx
  on command.projects (client_id)
  where client_id is not null;

create index command_signals_source_state_idx
  on command.signals (source, state);

create index command_approvals_state_idx
  on command.approvals (state, requested_at);

create unique index command_approvals_artifact_idx
  on command.approvals (artifact_kind, artifact_id);

-- ============================================================================
-- updated_at triggers — reuses set_updated_at() defined in 0001.
-- ============================================================================

do $$
declare t text;
begin
  for t in select unnest(array['projects','tasks','approvals']) loop
    execute format(
      'create trigger trg_command_%1$s_updated before update on command.%1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- Backfill from dev.projects → command.projects (preserves UUIDs).
-- The dev.project_state enum has the same value set as command.work_state, so
-- the cast via text is safe. dev.projects.owner is a free-text field; we leave
-- assigned_person_id null on backfill (it's a uuid soft-ref, no person row
-- matches the existing text owner). All backfilled projects land in the
-- engineering department.
-- ============================================================================

insert into command.projects (
  id, kind, slug, name, state, summary, current_focus,
  department_id, github_repo, local_path, vercel_project_id,
  archived_at, created_at, updated_at
)
select
  p.id,
  'internal_build'::command.work_kind,
  p.slug,
  p.name,
  p.state::text::command.work_state,
  p.summary,
  p.current_focus,
  (select id from command.departments where key = 'engineering'),
  p.github_repo,
  p.local_path,
  p.vercel_project_id,
  p.archived_at,
  p.created_at,
  p.updated_at
from dev.projects p
on conflict (id) do nothing;

-- ============================================================================
-- Backfill from dev.tasks → command.tasks (preserves UUIDs).
-- Status + priority enums are value-compatible.
-- ============================================================================

insert into command.tasks (
  id, project_id, title, notes, status, priority,
  due_date, done_at, origin, sort_index, created_at, updated_at
)
select
  t.id,
  t.project_id,
  t.title,
  t.notes,
  t.status::text::command.task_status,
  t.priority::text::command.task_priority,
  t.due_date,
  t.done_at,
  'manual'::command.task_origin,
  t.sort_index,
  t.created_at,
  t.updated_at
from dev.tasks t
on conflict (id) do nothing;
