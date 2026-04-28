-- Pulse Voice — agency LLM gateway + brand voice library.
-- All tables under the `voice` schema. The runs log captures every LLM call
-- across the suite so cost + prompt versioning live in one place.
-- Cross-tool linkage to clients/people uses soft uuid columns (no FKs).

create schema if not exists voice;

create or replace function voice.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Brand briefs: per-client voice doc. Versioned by inserting new rows; the
-- "active" version is the highest version number per client_id.
create table if not exists voice.brand_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,                          -- soft FK to social schema clients
  version int not null default 1,
  body_md text not null default '',
  do_list text[] not null default '{}',
  dont_list text[] not null default '{}',
  sample_copy text,
  updated_by_person_id uuid,               -- soft FK to social schema people
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_brand_briefs_client_idx
  on voice.brand_briefs (client_id, version desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_voice_brand_briefs_updated') then
    create trigger trg_voice_brand_briefs_updated
      before update on voice.brand_briefs
      for each row execute function voice.set_updated_at();
  end if;
end $$;

-- Prompt templates: the library every other tool calls into via the gateway.
-- `applies_to` is a free-form string so future surfaces can register their own
-- (e.g. analytics_insight, analytics_recommendation) without enum migrations.
create table if not exists voice.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  applies_to text not null default 'custom',
  system_md text not null default '',
  user_md_template text not null default '',
  default_model text not null default 'claude-sonnet-4-5-20250929',
  version int not null default 1,
  archived boolean not null default false,
  created_by_person_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_voice_templates_updated') then
    create trigger trg_voice_templates_updated
      before update on voice.prompt_templates
      for each row execute function voice.set_updated_at();
  end if;
end $$;

-- Glossary: banned + preferred phrases per client (or globally).
create table if not exists voice.glossary (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,                          -- null = global
  kind text not null check (kind in ('banned','preferred','term')),
  text text not null,
  replacement text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists voice_glossary_client_idx on voice.glossary (client_id);

-- Service tokens: how other apps call /api/llm/run securely.
create table if not exists voice.service_tokens (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_hash text not null unique,
  scopes text[] not null default '{llm:run}',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Runs log: append-only record of every LLM call across the suite.
create table if not exists voice.runs (
  id uuid primary key default gen_random_uuid(),
  prompt_template_id uuid references voice.prompt_templates(id) on delete set null,
  prompt_slug text,
  client_id uuid,                          -- soft FK
  person_id uuid,                          -- soft FK
  calling_app text not null default 'voice',
  input_json jsonb,
  output text,
  output_json jsonb,
  model text,
  tokens_in int,
  tokens_out int,
  cost_cents int,
  latency_ms int,
  used_in text,                            -- e.g. "post:<uuid>", "recommendation:<uuid>"
  status text not null default 'ok' check (status in ('ok','error','stub')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists voice_runs_created_idx on voice.runs (created_at desc);
create index if not exists voice_runs_app_idx on voice.runs (calling_app, created_at desc);
create index if not exists voice_runs_template_idx on voice.runs (prompt_template_id, created_at desc);

-- Seed prompt templates so the gateway is useful from minute one.
-- We use INSERT ... ON CONFLICT DO NOTHING for idempotency.

insert into voice.prompt_templates (slug, name, description, applies_to, system_md, user_md_template, default_model)
values (
  'post-caption',
  'Post caption rewriter',
  'Rewrites a draft caption in the client brand voice; returns 3 variants.',
  'post_caption',
  'You are a senior copywriter for Pulse Community Agency. Voice: warm, editorial, confident, never hype-y. Avoid em-dashes used as filler, avoid "unlock", "elevate", "transform". Match the client brand brief. Return exactly 3 caption variants ranked by your confidence, each on its own line, no numbering.',
  'CLIENT BRAND BRIEF:\n{{brand_brief}}\n\nDRAFT CAPTION:\n{{draft}}\n\nNotes from the team:\n{{notes}}',
  'claude-sonnet-4-5-20250929'
),
(
  'shoot-brief',
  'Pre-shoot brief',
  'Generates a tight pre-shoot brief from a frame + capture list + linked posts.',
  'shoot_brief',
  'You are a producer at a content agency. Write a one-paragraph pre-shoot brief: what we are shooting, the editorial frame, and the 3 most important things the field team must capture. Keep it under 120 words. Do not add headings or bullets.',
  'STRATEGIC FRAME:\n{{frame}}\n\nCAPTURE LIST:\n{{captures}}\n\nLINKED POSTS:\n{{linked_posts}}',
  'claude-sonnet-4-5-20250929'
),
(
  'sales-email',
  'Cold sales follow-up',
  'Writes a short cold-email follow-up for the CRM, in Pulse voice.',
  'sales_email',
  'You write short, warm B2B follow-up emails for a creative agency. 80 words max. No subject line. Open with a fact about the prospect, end with a single concrete next step.',
  'PROSPECT NOTES:\n{{notes}}\n\nLAST INTERACTION:\n{{last_touch}}\n\nWHAT WE WANT FROM THEM:\n{{ask}}',
  'claude-sonnet-4-5-20250929'
),
(
  'analytics-insight',
  'Performance insight (analytics)',
  'Reads 28d of metrics + post metadata + brand brief, returns markdown narrative.',
  'analytics_insight',
  'You are a performance analyst for a content agency. Given a 28-day window of post metrics and the brand brief, write a 150-word narrative insight in markdown. Open with the most surprising finding. Close with one specific question for the team. Cite at least 2 evidence post IDs in [pid:UUID] form.',
  'BRAND BRIEF:\n{{brand_brief}}\n\nMETRICS WINDOW:\n{{metrics}}\n\nPOSTS:\n{{posts}}',
  'claude-sonnet-4-5-20250929'
),
(
  'analytics-recommendation',
  'Performance recommendation (analytics)',
  'Returns a typed list of 3-5 concrete actions for the next two weeks. Used with structured output.',
  'analytics_recommendation',
  'You are a performance analyst for a content agency. Propose 3-5 concrete actions for the next 2 weeks based on the metrics window. Each action must include: kind (one of: new_post, repeat_post, change_format, change_cadence, pillar_rebalance, audience_test), title (max 60 chars), rationale_md (max 200 chars), evidence_post_ids (array of UUIDs from the input). Be specific. Reference real evidence.',
  'BRAND BRIEF:\n{{brand_brief}}\n\nLATEST INSIGHT:\n{{latest_insight}}\n\nRECENT POSTS:\n{{recent_posts}}',
  'claude-sonnet-4-5-20250929'
),
(
  'analytics-tag-post',
  'Auto-tag a post (analytics)',
  'Tags a single post with pillar / hook style / format quality. Structured output.',
  'analytics_tag_post',
  'You classify social posts. Return a JSON object with: pillar (one of: educational, promotional, behind_the_scenes, testimonial, lifestyle, news, other), hook_style (one of: question, statement, list, story, contrarian, none), format_quality (1-5 integer), reasoning (max 100 chars).',
  'CAPTION:\n{{caption}}\n\nMEDIA TYPE: {{media_type}}\n\nMETRICS: {{metrics}}',
  'claude-sonnet-4-5-20250929'
),
(
  'analytics-chart-pick',
  'AI auto-visualize (analytics)',
  'Picks a chart spec for a natural-language question over a metrics dataset. Structured output.',
  'analytics_chart_pick',
  'You select a chart for a question over a metrics dataset. Return a JSON object: chart_type (line | bar | scatter | table), x_axis (string), y_axis (string), series (array of {label, dataset_filter}), title (max 60 chars), explanation (max 120 chars).',
  'QUESTION: {{question}}\n\nAVAILABLE COLUMNS: {{columns}}\n\nDATASET PREVIEW:\n{{preview}}',
  'claude-sonnet-4-5-20250929'
)
on conflict (slug) do nothing;
