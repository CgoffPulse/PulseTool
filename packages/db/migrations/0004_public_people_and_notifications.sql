-- Phase 2.1 — People + Notifications + role-aware FK fields.
-- Idempotent. Standing up the substrate that automation/AI plug into.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. People — lightweight team roster (no auth, no logins)
-- ───────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'person_role') then
    create type person_role as enum ('field','strategy','producer','editor','approver');
  end if;
end $$;

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role person_role not null default 'producer',
  color text not null default '#27452b',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_people_updated') then
    create trigger trg_people_updated
      before update on people
      for each row execute function set_updated_at();
  end if;
end $$;

-- Seed two known people so the app has real options out of the box.
-- Re-running is safe: skip if name already exists.
insert into people (name, role, color)
select 'Christian', 'strategy', '#27452b'
where not exists (select 1 from people where name = 'Christian');

insert into people (name, role, color)
select 'Trey', 'field', '#c96f1f'
where not exists (select 1 from people where name = 'Trey');

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Notifications — the in-app feed
-- ───────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_severity') then
    create type notification_severity as enum ('info','warn','bad');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type notification_kind as enum (
      'today_action',
      'stuck_post',
      'lead_time_tight',
      'missing_month_plan',
      'coverage_gap',
      'shoot_unassigned',
      'asset_overdue',
      'month_generation_due',
      'shoot_schedule_conflict',
      'ride_along_opportunity',
      'quota_shortfall'
    );
  end if;
end $$;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind notification_kind not null,
  severity notification_severity not null default 'info',
  -- Audience targeting: null+null = "anyone on the team."
  audience_role person_role,
  audience_person_id uuid references people(id) on delete set null,
  -- The dedup key. The action engine upserts on this; re-running keeps the
  -- feed in sync with reality without spamming duplicates.
  dedup_key text not null unique,
  title text not null,
  detail text,
  link_url text,
  related_post_id uuid references posts(id) on delete cascade,
  related_shoot_id uuid references shoots(id) on delete cascade,
  related_client_id uuid references clients(id) on delete cascade,
  related_month_id uuid references months(id) on delete cascade,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_open_idx
  on notifications (dismissed_at, resolved_at, created_at desc);
create index if not exists notifications_audience_idx
  on notifications (audience_person_id, audience_role);
create index if not exists notifications_kind_idx on notifications (kind);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_notifications_updated') then
    create trigger trg_notifications_updated
      before update on notifications
      for each row execute function set_updated_at();
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Role-aware FKs on shoots + posts
-- ───────────────────────────────────────────────────────────────────────────
alter table shoots
  add column if not exists assigned_person_id uuid references people(id) on delete set null;

alter table posts
  add column if not exists owner_person_id uuid references people(id) on delete set null;

create index if not exists shoots_assigned_person_idx on shoots (assigned_person_id);
create index if not exists posts_owner_person_idx on posts (owner_person_id);

-- Backfill: any shoot whose `assigned_to` matches a known person's name gets
-- the person FK set, so existing data lights up immediately on the new view.
update shoots s
set assigned_person_id = p.id
from people p
where s.assigned_person_id is null
  and s.assigned_to is not null
  and lower(trim(s.assigned_to)) = lower(p.name);
