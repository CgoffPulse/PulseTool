-- Pulse Dev Hub - initial schema
-- All tables live under the `dev` schema; `public.*` (the social tool) is
-- untouched. Cross-tool references use slugs as soft keys (no FKs across
-- schemas) — see packages/db/ENTITY_OWNERSHIP.md.

create schema if not exists dev;

create type dev.project_state as enum ('idea','active','paused','shipped','archived');
create type dev.task_status   as enum ('backlog','next','in_progress','blocked','done','cancelled');
create type dev.task_priority as enum ('p0','p1','p2','p3');

create table dev.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  state dev.project_state not null default 'idea',
  summary text,
  current_focus text,
  owner text,
  github_repo text,                 -- "owner/name"
  local_path text,                  -- e.g. "/Users/christian/Developer/foo"
  vercel_project_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dev.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references dev.projects(id) on delete set null,  -- null = inbox task
  title text not null,
  notes text,
  status dev.task_status not null default 'backlog',
  priority dev.task_priority not null default 'p2',
  due_date date,
  done_at timestamptz,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-mostly monitoring snapshots; queries take latest per project.
create table dev.repo_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references dev.projects(id) on delete cascade,
  observed_at timestamptz not null default now(),
  default_branch text,
  last_commit_sha text,
  last_commit_at timestamptz,
  last_commit_message text,
  open_pr_count int,
  open_issue_count int,
  ahead int,
  behind int
);

create table dev.fs_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references dev.projects(id) on delete cascade,
  observed_at timestamptz not null default now(),
  current_branch text,
  is_dirty boolean,
  last_modified_at timestamptz,
  uncommitted_files int
);

create table dev.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references dev.projects(id) on delete cascade,
  observed_at timestamptz not null default now(),
  provider text not null default 'vercel',
  state text,                        -- READY / ERROR / BUILDING / …
  url text,
  commit_sha text,
  deployed_at timestamptz
);

create index tasks_project_status_idx on dev.tasks (project_id, status, sort_index);
create index tasks_status_due_idx     on dev.tasks (status, due_date);
create index repo_activity_proj_idx   on dev.repo_activity (project_id, observed_at desc);
create index fs_snapshots_proj_idx    on dev.fs_snapshots  (project_id, observed_at desc);
create index deployments_proj_idx     on dev.deployments   (project_id, observed_at desc);

-- updated_at triggers; reuses set_updated_at() from public schema (defined in 0001).
do $$
declare t text;
begin
  for t in select unnest(array['projects','tasks']) loop
    execute format(
      'create trigger trg_dev_%1$s_updated before update on dev.%1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;
