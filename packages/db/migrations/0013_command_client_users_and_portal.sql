-- 0013_command_client_users_and_portal.sql
-- Client-facing portal data layer (UI ships in a follow-up session).
-- command.client_users are the people associated with a clients row in the
-- public schema who can magic-link into the read-only status portal.
-- command.portal_tokens are single-use signed-URL grants for portal sessions
-- and per-artifact approval flows. client_id is a slug-soft uuid pointer; no
-- FK across schemas.

create extension if not exists citext;

-- ============================================================================
-- Client users — per-client people who can log in to the portal.
-- ============================================================================

create table command.client_users (
  id uuid primary key default gen_random_uuid(),
  -- Slug-soft reference to the clients table id (in the public schema); NO FK.
  client_id uuid not null,
  email citext not null,
  name text,
  role text not null default 'viewer',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, email)
);

-- ============================================================================
-- Portal tokens — single-use signed-URL grants.
-- purpose='portal_session' = read-only portal entry.
-- purpose='approval' = artifact-scoped approve/request-changes write path.
-- ============================================================================

create table command.portal_tokens (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references command.client_users(id) on delete cascade,
  token text not null unique,
  purpose text not null check (purpose in ('portal_session','approval')),
  artifact_kind text,
  artifact_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index command_portal_tokens_user_expiry_idx
  on command.portal_tokens (client_user_id, expires_at);

-- updated_at trigger on client_users only (portal_tokens is append-only +
-- consumed_at flip).
create trigger trg_command_client_users_updated
  before update on command.client_users
  for each row execute function set_updated_at();
