-- 0014_cross_command_crm_voice_followups.sql
-- @cross-schema: kind values use a dotted namespace (e.g. 'crm.stalled',
--   'shoot.post') and the template_slug column points at voice.prompt_templates
--   slugs by convention. No actual cross-schema reads/writes happen in this
--   migration — only the command schema is touched. The cross declaration
--   exists so the schema-isolation linter does not false-positive on the
--   string-literal kind values.
-- Generalized follow-up queue. Replaces the existing CRM-only follow-up cron
-- shape with a cross-domain table that supports stalled-deal chases,
-- post-shoot 24h notes, retainer-renewal reminders, missed-approval
-- chasers, and onboarding check-ins. apps/crm migrates its existing
-- follow-ups cron writer here over time. client_id, assigned_person_id
-- and subject_id are slug-soft uuid pointers; no FKs across schemas.

create table command.followups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'crm.stalled',
    'shoot.post',
    'retainer.renewal',
    'approval.chase',
    'onboarding.check_in'
  )),
  subject_kind text not null check (subject_kind in (
    'lead',
    'client',
    'project',
    'approval'
  )),
  subject_id uuid not null,
  -- Slug-soft references; NO FKs.
  client_id uuid,
  assigned_person_id uuid,
  due_at timestamptz not null,
  state text not null default 'open' check (state in (
    'open',
    'sent',
    'done',
    'dismissed'
  )),
  -- Optional prompt-template slug (from the voice schema) used to draft copy.
  template_slug text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index command_followups_state_due_idx
  on command.followups (state, due_at);

create index command_followups_client_idx
  on command.followups (client_id, state)
  where client_id is not null;

create trigger trg_command_followups_updated
  before update on command.followups
  for each row execute function set_updated_at();
