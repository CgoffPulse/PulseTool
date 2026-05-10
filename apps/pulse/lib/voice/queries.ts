import 'server-only';
import { q, qOne } from '../db';
import type {
  BrandBrief,
  BrandBriefWithClient,
  ClientLite,
  GlossaryEntry,
  GlossaryEntryWithClient,
  LibraryStats,
  PromptTemplate,
  Run,
  RunWithMeta,
  ServiceToken,
} from './types';

// ─── Clients (cross-tool, lives in public schema) ──────────────────────────

export async function listClients(): Promise<ClientLite[]> {
  try {
    return await q<ClientLite>(
      `select id, name, slug
         from clients
        where archived = false
        order by name`
    );
  } catch {
    return [];
  }
}

// ─── Brand briefs ──────────────────────────────────────────────────────────

const BRIEF_SELECT_WITH_CLIENT = `
  select
    b.id, b.client_id, b.version, b.body_md, b.do_list, b.dont_list,
    b.sample_copy, b.updated_by_person_id, b.created_at, b.updated_at,
    c.name as client_name, c.slug as client_slug
  from voice.brand_briefs b
  left join clients c on c.id = b.client_id
`;

/**
 * The most recent brief per client (latest version wins). Includes client
 * meta. Also returns globally-scoped briefs (client_id is null).
 */
export async function listLatestBriefs(): Promise<BrandBriefWithClient[]> {
  return q<BrandBriefWithClient>(
    `with ranked as (
       select b.*, row_number() over (
         partition by coalesce(b.client_id::text, '__global__')
         order by b.version desc, b.updated_at desc
       ) as rn
         from voice.brand_briefs b
     )
     select
       r.id, r.client_id, r.version, r.body_md, r.do_list, r.dont_list,
       r.sample_copy, r.updated_by_person_id, r.created_at, r.updated_at,
       c.name as client_name, c.slug as client_slug
       from ranked r
       left join clients c on c.id = r.client_id
      where r.rn = 1
      order by coalesce(c.name, '~') asc`
  );
}

export async function getLatestBriefForClient(
  clientId: string
): Promise<BrandBriefWithClient | null> {
  return qOne<BrandBriefWithClient>(
    `${BRIEF_SELECT_WITH_CLIENT}
     where b.client_id = $1
     order by b.version desc
     limit 1`,
    [clientId]
  );
}

export async function listBriefVersionsForClient(
  clientId: string
): Promise<BrandBrief[]> {
  return q<BrandBrief>(
    `select id, client_id, version, body_md, do_list, dont_list, sample_copy,
            updated_by_person_id, created_at, updated_at
       from voice.brand_briefs
      where client_id = $1
      order by version desc`,
    [clientId]
  );
}

// ─── Templates ─────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<PromptTemplate[]> {
  return q<PromptTemplate>(
    `select id, slug, name, description, applies_to, system_md, user_md_template,
            default_model, version, archived, created_by_person_id,
            created_at, updated_at
       from voice.prompt_templates
      order by archived asc, applies_to asc, name asc`
  );
}

export async function getTemplateBySlug(
  slug: string
): Promise<PromptTemplate | null> {
  return qOne<PromptTemplate>(
    `select id, slug, name, description, applies_to, system_md, user_md_template,
            default_model, version, archived, created_by_person_id,
            created_at, updated_at
       from voice.prompt_templates
      where slug = $1
      limit 1`,
    [slug]
  );
}

// ─── Glossary ──────────────────────────────────────────────────────────────

export async function listGlossary(
  filterClientId?: string | null
): Promise<GlossaryEntryWithClient[]> {
  if (filterClientId === undefined) {
    return q<GlossaryEntryWithClient>(
      `select g.id, g.client_id, g.kind::text as kind, g.text, g.replacement,
              g.note, g.created_at, c.name as client_name
         from voice.glossary g
         left join clients c on c.id = g.client_id
        order by g.created_at desc`
    );
  }
  if (filterClientId === null) {
    return q<GlossaryEntryWithClient>(
      `select g.id, g.client_id, g.kind::text as kind, g.text, g.replacement,
              g.note, g.created_at, c.name as client_name
         from voice.glossary g
         left join clients c on c.id = g.client_id
        where g.client_id is null
        order by g.created_at desc`
    );
  }
  return q<GlossaryEntryWithClient>(
    `select g.id, g.client_id, g.kind::text as kind, g.text, g.replacement,
            g.note, g.created_at, c.name as client_name
       from voice.glossary g
       left join clients c on c.id = g.client_id
      where g.client_id = $1
      order by g.created_at desc`,
    [filterClientId]
  );
}

// ─── Service tokens ────────────────────────────────────────────────────────

export async function listServiceTokens(): Promise<ServiceToken[]> {
  return q<ServiceToken>(
    `select id, label, token_hash, scopes, created_at, revoked_at
       from voice.service_tokens
      order by revoked_at asc nulls first, created_at desc`
  );
}

// ─── Runs ──────────────────────────────────────────────────────────────────

const RUN_WITH_META_SELECT = `
  select
    r.id, r.prompt_template_id, r.prompt_slug, r.client_id, r.person_id,
    r.calling_app, r.input_json, r.output, r.output_json, r.model,
    r.tokens_in, r.tokens_out, r.cost_cents, r.latency_ms, r.used_in,
    r.status, r.error, r.created_at,
    t.name as template_name, t.slug as template_slug,
    c.name as client_name
  from voice.runs r
  left join voice.prompt_templates t on t.id = r.prompt_template_id
  left join clients c on c.id = r.client_id
`;

export interface RunsFilter {
  callingApp?: string | null;
  limit?: number;
  offset?: number;
}

export async function listRuns(
  filter: RunsFilter = {}
): Promise<RunWithMeta[]> {
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  const params: unknown[] = [];
  let where = '';
  if (filter.callingApp) {
    params.push(filter.callingApp);
    where = `where r.calling_app = $${params.length}`;
  }
  params.push(limit, offset);
  return q<RunWithMeta>(
    `${RUN_WITH_META_SELECT}
     ${where}
     order by r.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params
  );
}

export async function getRun(id: string): Promise<RunWithMeta | null> {
  return qOne<RunWithMeta>(
    `${RUN_WITH_META_SELECT}
     where r.id = $1`,
    [id]
  );
}

export async function listRecentRuns(limit = 10): Promise<RunWithMeta[]> {
  return listRuns({ limit });
}

// ─── Library stats ─────────────────────────────────────────────────────────

export async function getLibraryStats(): Promise<LibraryStats> {
  const row = await qOne<{
    templates_count: number;
    briefs_count: number;
    runs_7d: number;
    cost_cents_7d: string;
  }>(
    `select
       (select count(*) from voice.prompt_templates where archived = false)::int as templates_count,
       (select count(distinct coalesce(client_id::text, '__global__'))
          from voice.brand_briefs)::int as briefs_count,
       (select count(*) from voice.runs
          where created_at >= now() - interval '7 days')::int as runs_7d,
       (select coalesce(sum(cost_cents), 0) from voice.runs
          where created_at >= now() - interval '7 days')::text as cost_cents_7d`
  );
  return {
    templates_count: row?.templates_count ?? 0,
    briefs_count: row?.briefs_count ?? 0,
    runs_7d: row?.runs_7d ?? 0,
    cost_cents_7d: row ? Number(row.cost_cents_7d) : 0,
  };
}

// ─── Helper used by playground ────────────────────────────────────────────

export interface RunInsertData {
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
  status: 'ok' | 'error' | 'stub';
  error: string | null;
}

export async function insertRun(data: RunInsertData): Promise<Run> {
  const row = await qOne<Run>(
    `insert into voice.runs (
       prompt_template_id, prompt_slug, client_id, person_id, calling_app,
       input_json, output, output_json, model, tokens_in, tokens_out,
       cost_cents, latency_ms, used_in, status, error
     )
     values ($1, $2, $3, $4, $5,
             $6::jsonb, $7, $8::jsonb, $9, $10, $11,
             $12, $13, $14, $15, $16)
     returning *`,
    [
      data.prompt_template_id,
      data.prompt_slug,
      data.client_id,
      data.person_id,
      data.calling_app,
      JSON.stringify(data.input_json ?? null),
      data.output,
      JSON.stringify(data.output_json ?? null),
      data.model,
      data.tokens_in,
      data.tokens_out,
      data.cost_cents,
      data.latency_ms,
      data.used_in,
      data.status,
      data.error,
    ]
  );
  if (!row) throw new Error('Failed to insert run');
  return row;
}
