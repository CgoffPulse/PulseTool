-- Pulse CRM — initial schema
-- All tables live under the `crm` schema. Cross-tool linkage to clients in
-- the social tool's clients table is intentionally a soft column with no
-- physical FK constraint; promotion happens through application code that
-- inserts into the clients table and stamps the resulting id on crm.leads.

create schema if not exists crm;

-- Enums --------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'crm_lead_stage') then
    create type crm.lead_stage as enum (
      'new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'crm_touch_kind') then
    create type crm.touch_kind as enum (
      'email', 'call', 'meeting', 'dm', 'proposal', 'note'
    );
  end if;
end $$;

-- Helper: trigger fn (dedicated copy in `crm` so we don't depend on `public`).

create or replace function crm.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Sources -- where leads come from -----------------------------------------

create table if not exists crm.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_index int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

insert into crm.sources (slug, label, sort_index) values
  ('referral', 'Referral', 10),
  ('inbound-website', 'Inbound (Website)', 20),
  ('inbound-instagram', 'Inbound (Instagram)', 30),
  ('cold-outreach', 'Cold outreach', 40),
  ('event', 'Event / IRL', 50),
  ('partner', 'Partner / Agency', 60),
  ('other', 'Other', 90)
on conflict (slug) do nothing;

-- Lost reasons --------------------------------------------------------------

create table if not exists crm.lost_reasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_index int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

insert into crm.lost_reasons (slug, label, sort_index) values
  ('price', 'Price', 10),
  ('timing', 'Timing / not now', 20),
  ('competitor', 'Went with a competitor', 30),
  ('not-a-fit', 'Not a fit', 40),
  ('ghosted', 'Ghosted', 50),
  ('other', 'Other', 90)
on conflict (slug) do nothing;

-- Leads ---------------------------------------------------------------------

create table if not exists crm.leads (
  id uuid primary key default gen_random_uuid(),
  -- Identity
  name text not null,
  company text,
  email text,
  phone text,
  -- Pipeline state
  stage crm.lead_stage not null default 'new',
  source_id uuid references crm.sources(id) on delete set null,
  lost_reason_id uuid references crm.lost_reasons(id) on delete set null,
  -- Sales economics
  value_cents bigint,
  expected_close_date date,
  -- Ownership (people lives in the social tool; soft column - no cross-schema FK)
  owner_person_id uuid,
  -- Promotion bridge: if this lead becomes a client in apps/social, we stamp
  -- the resulting clients-row id here. Soft column - no cross-schema FK.
  client_id uuid,
  -- Free-form
  notes text,
  -- Lifecycle
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_stage_idx on crm.leads (stage) where archived = false;
create index if not exists crm_leads_owner_idx on crm.leads (owner_person_id) where archived = false;
create index if not exists crm_leads_source_idx on crm.leads (source_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_crm_leads_updated') then
    create trigger trg_crm_leads_updated
      before update on crm.leads
      for each row execute function crm.set_updated_at();
  end if;
end $$;

-- Touches - append-mostly outreach log -------------------------------------

create table if not exists crm.touches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references crm.leads(id) on delete cascade,
  kind crm.touch_kind not null,
  happened_at timestamptz not null default now(),
  summary text,
  person_id uuid,                 -- soft FK to people in the social tool
  follow_up_at timestamptz,       -- next nudge for this lead, after this touch
  created_at timestamptz not null default now()
);

create index if not exists crm_touches_lead_idx on crm.touches (lead_id, happened_at desc);
create index if not exists crm_touches_followup_idx on crm.touches (follow_up_at)
  where follow_up_at is not null;

-- Events - append-only stage transitions ------------------------------------

create table if not exists crm.events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references crm.leads(id) on delete cascade,
  from_stage crm.lead_stage,
  to_stage crm.lead_stage not null,
  at timestamptz not null default now(),
  by_person_id uuid,              -- soft FK to people in the social tool
  note text
);

create index if not exists crm_events_lead_idx on crm.events (lead_id, at desc);
