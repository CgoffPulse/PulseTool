-- 0012_public_clients_and_service_lines.sql
-- Adds tier + service-line awareness to public.clients (so the assignment
-- engine + onboarding cascade can pick the right defaults per client) and
-- creates the public.service_lines lookup table that drives those defaults.
-- ONSC is anchored to the 'premium' tier per agency discovery; everyone else
-- defaults to 'mid'.

-- ============================================================================
-- Client tier — premium / mid / productized.
-- ============================================================================

do $$ begin
  create type public.client_tier as enum ('premium','mid','productized');
exception
  when duplicate_object then null;
end $$;

alter table public.clients
  add column if not exists tier public.client_tier not null default 'mid';

alter table public.clients
  add column if not exists service_lines text[] not null default '{content}';

-- Anchor ONSC to the premium tier (no-op if no row matches the slug).
update public.clients set tier = 'premium' where slug = 'onsc';

-- ============================================================================
-- Service lines lookup — drives onboarding defaults, quotas, cadence.
-- ============================================================================

create table if not exists public.service_lines (
  key text primary key,
  name text not null,
  default_quotas jsonb not null default '{}'::jsonb,
  default_cadence text,
  is_local_business boolean not null default true,
  sort_index int not null default 0
);

insert into public.service_lines (key, name, default_quotas, default_cadence, is_local_business, sort_index) values
  ('content',            'Content marketing',                    '{"posts_per_week":3,"shoots_per_month":2}'::jsonb, 'monthly', true, 1),
  ('seo_local',          'Local SEO & Google Business Profile',  '{}'::jsonb,                                         'monthly', true, 2),
  ('reviews_reputation', 'Reviews & reputation',                 '{}'::jsonb,                                         'weekly',  true, 3),
  ('lead_nurture',       'Lead nurture & email automation',      '{}'::jsonb,                                         'weekly',  true, 4),
  ('paid_ads',           'Paid ads',                             '{}'::jsonb,                                         'weekly',  true, 5),
  ('web_landing',        'Web & landing pages',                  '{}'::jsonb,                                         'project', true, 6),
  ('ai_tool_build',      'AI tool builds',                       '{}'::jsonb,                                         'project', true, 7)
on conflict (key) do nothing;
