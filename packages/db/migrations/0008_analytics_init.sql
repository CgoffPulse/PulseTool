-- Pulse Analytics — performance ingest + AI-native insights.
-- All tables under the `analytics` schema. Cross-tool references to social
-- clients/posts use soft uuid columns (no cross-schema FKs).

create schema if not exists analytics;

create or replace function analytics.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Platform connections per client. access_token_ref points at an env-keyed
-- value or a Supabase Vault secret name; the actual token lives in env so
-- this row stays cheap to read and easy to share.
create table if not exists analytics.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,                  -- soft FK to social.clients
  platform text not null check (platform in ('instagram','facebook','ga4')),
  handle text,
  external_id text,                         -- IG Business id, FB page id, GA4 property id
  access_token_ref text,                    -- env var name or vault key
  status text not null default 'pending' check (status in ('pending','connected','error','revoked')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, platform, external_id)
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_analytics_accounts_updated') then
    create trigger trg_analytics_accounts_updated
      before update on analytics.platform_accounts
      for each row execute function analytics.set_updated_at();
  end if;
end $$;

-- Account-level daily metrics (followers, reach, profile visits).
create table if not exists analytics.account_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references analytics.platform_accounts(id) on delete cascade,
  date date not null,
  followers int,
  reach int,
  impressions int,
  profile_visits int,
  website_clicks int,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);
create index if not exists analytics_amd_acct_date_idx
  on analytics.account_metrics_daily (account_id, date desc);

-- GA4 site-level daily metrics. Lives next to social account metrics so the
-- per-client pages can stitch them on the same sparkline strip.
create table if not exists analytics.ga4_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  date date not null,
  sessions int,
  users int,
  conversions int,
  bounce_rate float,
  avg_session_seconds float,
  top_source_json jsonb,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, date)
);
create index if not exists analytics_ga4_client_date_idx
  on analytics.ga4_metrics_daily (client_id, date desc);

-- Posts as they exist on the platform side (one row per platform_post_id).
create table if not exists analytics.posts_external (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references analytics.platform_accounts(id) on delete cascade,
  platform_post_id text not null,
  posted_at timestamptz,
  caption text,
  media_type text,                         -- IMAGE | VIDEO | CAROUSEL_ALBUM | REEL | etc.
  permalink text,
  thumbnail_url text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, platform_post_id)
);
create index if not exists analytics_posts_external_account_idx
  on analytics.posts_external (account_id, posted_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_analytics_posts_external_updated') then
    create trigger trg_analytics_posts_external_updated
      before update on analytics.posts_external
      for each row execute function analytics.set_updated_at();
  end if;
end $$;

-- Per-post metric snapshots. Append-mostly; queries take the latest snapshot
-- per post when displaying.
create table if not exists analytics.post_metrics (
  id uuid primary key default gen_random_uuid(),
  posts_external_id uuid not null references analytics.posts_external(id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions int,
  reach int,
  likes int,
  comments int,
  saves int,
  shares int,
  video_views int,
  plays int,
  completion_rate float,
  raw jsonb,
  unique (posts_external_id, captured_at)
);
create index if not exists analytics_post_metrics_post_idx
  on analytics.post_metrics (posts_external_id, captured_at desc);

-- Match table linking platform posts to planned social posts.
create table if not exists analytics.post_match (
  id uuid primary key default gen_random_uuid(),
  posts_external_id uuid not null references analytics.posts_external(id) on delete cascade unique,
  public_post_id uuid not null,            -- soft FK to social.posts
  matched_by text not null default 'human' check (matched_by in ('human','heuristic','ai')),
  confidence float,
  matched_at timestamptz not null default now()
);
create index if not exists analytics_post_match_public_idx
  on analytics.post_match (public_post_id);

-- AI-derived tags for posts (one row per tag).
create table if not exists analytics.post_tags (
  id uuid primary key default gen_random_uuid(),
  posts_external_id uuid not null references analytics.posts_external(id) on delete cascade,
  tag_kind text not null check (tag_kind in ('pillar','hook_style','format','hashtag_quality')),
  tag_value text not null,
  confidence float,
  source text not null default 'ai' check (source in ('ai','human')),
  run_id uuid,                              -- soft FK to the voice runs log
  created_at timestamptz not null default now(),
  unique (posts_external_id, tag_kind)
);
create index if not exists analytics_post_tags_post_idx
  on analytics.post_tags (posts_external_id);

-- Insights: AI-generated narrative summaries per client per period.
create table if not exists analytics.insights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  period_start date not null,
  period_end date not null,
  body_md text not null,
  evidence_post_ids uuid[] not null default '{}',
  run_id uuid,                              -- soft FK to the voice runs log
  generated_at timestamptz not null default now(),
  dismissed_at timestamptz
);
create index if not exists analytics_insights_client_idx
  on analytics.insights (client_id, generated_at desc);

-- Recommendations queue (Advisor mode).
create table if not exists analytics.recommendations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  kind text not null check (kind in (
    'new_post','repeat_post','change_format','change_cadence',
    'pillar_rebalance','audience_test'
  )),
  title text not null,
  rationale_md text not null,
  evidence_post_ids uuid[] not null default '{}',
  status text not null default 'proposed' check (status in ('proposed','accepted','dismissed')),
  accepted_at timestamptz,
  dismissed_at timestamptz,
  dismissed_reason text,
  target_post_id uuid,                      -- soft FK; set when accepted+drafted
  run_id uuid,                              -- soft FK to the voice runs log
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists analytics_recs_client_status_idx
  on analytics.recommendations (client_id, status, created_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_analytics_recs_updated') then
    create trigger trg_analytics_recs_updated
      before update on analytics.recommendations
      for each row execute function analytics.set_updated_at();
  end if;
end $$;

-- Saved charts: pinned natural-language queries with their typed chart spec.
create table if not exists analytics.saved_charts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  prompt text not null,
  chart_spec_json jsonb not null,
  pinned boolean not null default true,
  run_id uuid,
  created_by_person_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists analytics_saved_charts_client_idx
  on analytics.saved_charts (client_id, created_at desc);
