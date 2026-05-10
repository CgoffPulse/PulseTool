export type LeadStage =
  | 'new'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export const LEAD_STAGES: LeadStage[] = [
  'new',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export const ACTIVE_STAGES: LeadStage[] = [
  'new',
  'qualified',
  'proposal',
  'negotiation',
];

export type TouchKind = 'email' | 'call' | 'meeting' | 'dm' | 'proposal' | 'note';

export const TOUCH_KINDS: TouchKind[] = ['email', 'call', 'meeting', 'dm', 'proposal', 'note'];

export interface Source {
  id: string;
  slug: string;
  label: string;
  sort_index: number;
  archived: boolean;
}

export interface LostReason {
  id: string;
  slug: string;
  label: string;
  sort_index: number;
  archived: boolean;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: LeadStage;
  source_id: string | null;
  lost_reason_id: string | null;
  value_cents: number | null;
  expected_close_date: string | null;
  owner_person_id: string | null;
  client_id: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Touch {
  id: string;
  lead_id: string;
  kind: TouchKind;
  happened_at: string;
  summary: string | null;
  person_id: string | null;
  follow_up_at: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  lead_id: string;
  from_stage: LeadStage | null;
  to_stage: LeadStage;
  at: string;
  by_person_id: string | null;
  note: string | null;
}

export interface LeadWithMeta extends Lead {
  source_label: string | null;
  source_slug: string | null;
  last_touch_at: string | null;
  next_followup_at: string | null;
  owner_name: string | null;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface PipelineStats {
  this_month_new: number;
  this_month_won: number;
  this_month_lost: number;
  pipeline_value_cents: number;
  won_value_cents_mtd: number;
  active_leads: number;
  stalled_count: number;
}
