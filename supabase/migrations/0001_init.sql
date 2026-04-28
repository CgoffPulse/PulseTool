-- Pulse Social Planning - initial schema
-- Maps the multi-sheet Excel template to a normalized Postgres schema.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Enums
-- ============================================================================

create type content_type as enum ('reel','photo','carousel','story','video','graphic');
create type pillar as enum ('p1','p2','p3');
create type post_status as enum ('planned','ready','scheduled','posted');
create type shoot_asset_status as enum ('not_scheduled','scheduled','captured','delivered');
create type month_status as enum ('draft','ready','sent');
create type client_fit as enum ('onsc','el_pueblito','both');
create type shoot_client_scope as enum ('onsc','el_pueblito','either');
create type asset_provider as enum ('drive','dam','nas','supabase');

-- ============================================================================
-- Reference / configuration
-- ============================================================================

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color text not null default '#0ea5e9',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table strategic_frames (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  quarter text not null,
  quarter_start_date date,
  goal_90day text,
  primary_audience text,
  role_of_social text,
  brand_voice text,
  avoid text,
  pillar_1_name text,
  pillar_1_desc text,
  pillar_2_name text,
  pillar_2_desc text,
  pillar_3_name text,
  pillar_3_desc text,
  pillar_mix jsonb not null default '{"p1":33,"p2":33,"p3":34}'::jsonb,
  cadence text,
  contracted_shoots_per_month int,
  min_lead_time_days int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, quarter)
);

create table content_quotas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null,
  reels_target int,
  photos_target int,
  carousels_target int,
  stories_target int,
  videos_target int,
  graphics_target int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);

create table shoot_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  duration text,
  client_scope shoot_client_scope not null default 'either',
  required_capture_list text,
  produces_reels int not null default 0,
  produces_photos int not null default 0,
  produces_carousels int not null default 0,
  produces_stories int not null default 0,
  produces_videos int not null default 0,
  produces_graphics int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  date_label text not null,
  event text not null,
  client_fit client_fit not null default 'both',
  content_angle text,
  is_recurring boolean not null default true,
  client_specific_client_id uuid references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Working tables
-- ============================================================================

create table months (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null,
  cadence_override text,
  status month_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);

create table shoots (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  bundle_number int not null,
  shoot_template_id uuid references shoot_templates(id) on delete set null,
  scheduled_date date,
  scheduled_time text,
  location text,
  assigned_to text,
  asset_status shoot_asset_status not null default 'not_scheduled',
  drive_folder_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, bundle_number)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  post_date date not null,
  post_time text,
  platform text,
  pillar pillar,
  content_type content_type not null,
  description text,
  shoot_id uuid references shoots(id) on delete set null,
  status post_status not null default 'planned',
  asset_ready boolean not null default false,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references shoots(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,
  content_type content_type,
  provider asset_provider not null default 'drive',
  provider_ref text not null,
  thumbnail_path text,
  label text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index posts_month_date_idx on posts (month_id, post_date, sort_index);
create index posts_shoot_idx on posts (shoot_id);
create index shoots_month_idx on shoots (month_id, bundle_number);
create index assets_shoot_idx on assets (shoot_id);
create index holidays_client_idx on holidays (client_specific_client_id);

-- ============================================================================
-- updated_at triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'clients','strategic_frames','content_quotas','shoot_templates',
      'holidays','months','shoots','posts'
    ])
  loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;
