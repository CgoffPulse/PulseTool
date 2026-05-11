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

// ─── Profile vocab ─────────────────────────────────────────────────────────

export type LeadHeat = 'cold' | 'warm' | 'hot';
export const LEAD_HEATS: LeadHeat[] = ['cold', 'warm', 'hot'];

/**
 * Service lines a lead might be interested in. Soft-keyed to the same values
 * that live in `service_lines` (the lookup seeded by 0012). Kept as a plain
 * string union for easier form binding; treat as `string` if a new line ships
 * before this enum is updated.
 */
export type ServiceLineKey =
  | 'content'
  | 'seo_local'
  | 'reviews_reputation'
  | 'lead_nurture'
  | 'paid_ads'
  | 'web_landing'
  | 'ai_tool_build';

export const SERVICE_LINES: ReadonlyArray<{ key: ServiceLineKey; label: string; cadence: string }> = [
  { key: 'content',            label: 'Content marketing',                    cadence: 'monthly' },
  { key: 'seo_local',          label: 'Local SEO & Google Business Profile',  cadence: 'monthly' },
  { key: 'reviews_reputation', label: 'Reviews & reputation',                 cadence: 'weekly' },
  { key: 'lead_nurture',       label: 'Lead nurture & email automation',      cadence: 'weekly' },
  { key: 'paid_ads',           label: 'Paid ads',                             cadence: 'weekly' },
  { key: 'web_landing',        label: 'Web & landing pages',                  cadence: 'project' },
  { key: 'ai_tool_build',      label: 'AI tool builds',                       cadence: 'project' },
];

/**
 * A loose taxonomy of local-business types Pulse commonly works with.
 * Drives a fast-pick datalist on the new-lead form; arbitrary strings are
 * still accepted server-side so users aren't blocked when something new
 * walks in the door.
 */
export const BUSINESS_TYPES: ReadonlyArray<string> = [
  'Restaurant',
  'Bar',
  'Cafe',
  'Brewery',
  'Salon',
  'Spa',
  'Gym / Fitness studio',
  'Auto repair',
  'Auto detailing',
  'Contractor',
  'Roofer',
  'HVAC',
  'Plumber',
  'Electrician',
  'Landscaper',
  'Cleaning service',
  'Real estate',
  'Insurance',
  'Law firm',
  'Accounting / Bookkeeping',
  'Medical practice',
  'Dental practice',
  'Chiropractor',
  'Veterinarian',
  'Pet groomer',
  'Retail / Boutique',
  'Coffee shop',
  'Bakery',
  'Florist',
  'Photographer',
  'Event venue',
  'Wedding planner',
  'Ranch / Farm',
  'Outdoor / Adventure',
  'Other',
];

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
  // Identity
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  // Pipeline
  stage: LeadStage;
  source_id: string | null;
  lost_reason_id: string | null;
  // Economics
  value_cents: number | null;
  expected_close_date: string | null;
  // Ownership / bridge
  owner_person_id: string | null;
  client_id: string | null;
  // Business profile
  industry: string | null;
  business_type: string | null;
  city: string | null;
  region: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  google_business_url: string | null;
  // Stakeholders
  decision_maker_name: string | null;
  decision_maker_title: string | null;
  // Opportunity shape
  services_interested: string[];
  budget_signal: string | null;
  timeline: string | null;
  heat: LeadHeat | null;
  // Discovery
  pain_points: string | null;
  current_solution: string | null;
  goals: string | null;
  referrer: string | null;
  // Flexible
  tags: string[];
  // Free-form
  notes: string | null;
  // Lifecycle
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
