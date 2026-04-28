-- Admin command center: richer roles on people + recurring expectations.
--
-- Roles: the existing person_role enum is kept for backward compat, but we
-- add a `roles text[]` column so a person can wear multiple hats (Trey:
-- photographer + videographer + drone). This avoids ALTER TYPE ADD VALUE,
-- which is non-transactional and our migration runner wraps each file in
-- BEGIN/COMMIT. New role names (founder, developer, social_media, ...)
-- live in this text[] going forward; the old single-role column gets
-- backfilled and stays as a fallback for code that hasn't been updated.
--
-- Recurring expectations: agency standards/SOPs with a known cadence and
-- a due rule. The action engine surfaces them as notifications when the
-- warning window opens and escalates when overdue. Completion is tracked
-- per period (yyyy-mm for monthly, yyyy-Www for weekly, etc.) so the same
-- standard re-arms each period without manual reset.

-- ---------- People: responsibilities + multi-role ------------------------

alter table public.people
  add column if not exists responsibilities text[] not null default '{}',
  add column if not exists roles text[];

-- Backfill multi-role from the existing single role enum.
update public.people set roles = array[role::text] where roles is null;

-- ---------- Recurring expectations ---------------------------------------

create table if not exists public.recurring_expectations (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  cadence text not null check (cadence in ('daily','weekly','monthly','quarterly')),
  -- Free-form due rule. Interpreted by the detector based on cadence:
  --   monthly:   'eom' (end of month) or 'dN' where 1 <= N <= 31
  --   weekly:    'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
  --   quarterly: 'eoq' (end of quarter)
  --   daily:     null (fires at start of day)
  due_rule text,
  warn_days int not null default 7 check (warn_days >= 0 and warn_days <= 60),
  -- Audience routing. If owner_person_id is set, the notification targets
  -- that person directly. owner_role is free text so 'founder' / 'developer'
  -- work without touching the person_role enum (which is constrained to
  -- field/strategy/producer/editor/approver). When owner_role matches one
  -- of those five, the detector also sets notifications.audience_role for
  -- the existing role-based filters; otherwise routing relies on the
  -- person_id alone.
  owner_role text,
  owner_person_id uuid references public.people(id) on delete set null,
  severity_warn text not null default 'warn' check (severity_warn in ('info','warn','bad')),
  severity_overdue text not null default 'bad' check (severity_overdue in ('info','warn','bad')),
  link_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expectations_active_idx
  on public.recurring_expectations(active) where active;

create table if not exists public.expectation_completions (
  id uuid primary key default gen_random_uuid(),
  expectation_id uuid not null references public.recurring_expectations(id) on delete cascade,
  -- Stable per-period key the detector computes from today + cadence.
  -- monthly:   yyyy-mm        (e.g. 2026-04)
  -- weekly:    yyyy-Www       (ISO week; e.g. 2026-W17)
  -- quarterly: yyyy-Qn        (e.g. 2026-Q2)
  -- daily:     yyyy-mm-dd
  period_key text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.people(id) on delete set null,
  notes text,
  unique (expectation_id, period_key)
);

create index if not exists expectation_completions_lookup_idx
  on public.expectation_completions(expectation_id, period_key);

-- updated_at trigger for recurring_expectations
create or replace function public.set_updated_at_recurring_expectations()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_recurring_expectations_updated_at on public.recurring_expectations;
create trigger trg_recurring_expectations_updated_at
  before update on public.recurring_expectations
  for each row execute function public.set_updated_at_recurring_expectations();

-- ---------- Seed: the example the user gave -------------------------------
-- "Social media calendar for all clients must be finished and sent before
-- end of month, every month." Idempotent via a unique title.
insert into public.recurring_expectations
  (title, description, cadence, due_rule, warn_days, owner_role, severity_warn, severity_overdue)
values (
  'Send next-month social calendar to clients',
  'Every month, the next-month plan needs to be finalized and sent to each client before EOM.',
  'monthly',
  'eom',
  10,
  'producer',
  'warn',
  'bad'
)
on conflict (title) do nothing;
