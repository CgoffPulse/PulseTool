-- 0016_crm_lead_profile_expansion.sql
-- Expands crm.leads from a thin contact record into a full agency-grade
-- lead profile. Pulse serves local businesses, so the model captures:
--   • Business identity (industry, business type, location, website + socials)
--   • Stakeholders (decision-maker name + title — distinct from primary contact)
--   • Opportunity shape (services interested in, budget signal, timeline, heat)
--   • Discovery (pain points, current solution, goals, referrer)
--   • Flexible tags
-- All new columns are nullable so existing rows keep working.

-- Postgres has no `if not exists` on `create type`; guard with a do-block.
do $$ begin
  create type crm.lead_heat as enum ('cold','warm','hot');
exception when duplicate_object then null;
end $$;

alter table crm.leads add column if not exists industry text;
alter table crm.leads add column if not exists business_type text;
alter table crm.leads add column if not exists city text;
alter table crm.leads add column if not exists region text;       -- state / province
alter table crm.leads add column if not exists website_url text;
alter table crm.leads add column if not exists instagram_handle text;
alter table crm.leads add column if not exists facebook_url text;
alter table crm.leads add column if not exists google_business_url text;

alter table crm.leads add column if not exists decision_maker_name text;
alter table crm.leads add column if not exists decision_maker_title text;

-- Services interested in — soft references to service-lines keys
-- (content, seo_local, reviews_reputation, lead_nurture, paid_ads, web_landing,
--  ai_tool_build). Stored as text[] so the form can multi-select freely.
alter table crm.leads add column if not exists services_interested text[] not null default '{}';

alter table crm.leads add column if not exists budget_signal text;     -- "around $2k/mo" or "no budget set"
alter table crm.leads add column if not exists timeline text;          -- "ASAP" / "Q3 2026" / "later this year"
alter table crm.leads add column if not exists heat crm.lead_heat;     -- nullable: unset means 'unknown'

alter table crm.leads add column if not exists pain_points text;
alter table crm.leads add column if not exists current_solution text;  -- who/what they use now
alter table crm.leads add column if not exists goals text;
alter table crm.leads add column if not exists referrer text;          -- who pointed them at us

alter table crm.leads add column if not exists tags text[] not null default '{}';

-- Indexes that pay off on the kanban + reports.
create index if not exists crm_leads_heat_idx on crm.leads (heat) where archived = false;
create index if not exists crm_leads_industry_idx on crm.leads (industry) where archived = false;
