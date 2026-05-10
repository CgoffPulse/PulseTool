export type CallingApp = 'crm' | 'social' | 'analytics' | 'voice' | 'huddle';

export const CALLING_APPS: CallingApp[] = [
  'crm',
  'social',
  'analytics',
  'voice',
  'huddle',
];

export type RunStatus = 'ok' | 'error' | 'stub';

export type GlossaryKind = 'banned' | 'preferred' | 'term';
export const GLOSSARY_KINDS: GlossaryKind[] = ['banned', 'preferred', 'term'];

export interface BrandBrief {
  id: string;
  client_id: string | null;
  version: number;
  body_md: string;
  do_list: string[];
  dont_list: string[];
  sample_copy: string | null;
  updated_by_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandBriefWithClient extends BrandBrief {
  client_name: string | null;
  client_slug: string | null;
}

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  applies_to: string;
  system_md: string;
  user_md_template: string;
  default_model: string;
  version: number;
  archived: boolean;
  created_by_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlossaryEntry {
  id: string;
  client_id: string | null;
  kind: GlossaryKind;
  text: string;
  replacement: string | null;
  note: string | null;
  created_at: string;
}

export interface GlossaryEntryWithClient extends GlossaryEntry {
  client_name: string | null;
}

export interface ServiceToken {
  id: string;
  label: string;
  token_hash: string;
  scopes: string[];
  created_at: string;
  revoked_at: string | null;
}

export interface Run {
  id: string;
  prompt_template_id: string | null;
  prompt_slug: string | null;
  client_id: string | null;
  person_id: string | null;
  calling_app: string;
  input_json: unknown;
  output: string | null;
  output_json: unknown;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
  latency_ms: number | null;
  used_in: string | null;
  status: RunStatus;
  error: string | null;
  created_at: string;
}

export interface RunWithMeta extends Run {
  template_name: string | null;
  template_slug: string | null;
  client_name: string | null;
}

export interface ClientLite {
  id: string;
  name: string;
  slug: string;
}

export interface LibraryStats {
  templates_count: number;
  briefs_count: number;
  runs_7d: number;
  cost_cents_7d: number;
}
