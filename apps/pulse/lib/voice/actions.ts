'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, qOne } from '../db';
import { generateToken, hashToken } from './auth-gateway';
import { runPrompt } from './llm/anthropic';
import {
  injectBrandBrief,
  injectGlossary,
  resolveTemplate,
} from './template-resolver';
import { insertRun } from './queries';
import { GLOSSARY_KINDS } from './types';
import { slugify } from '../utils';

const optionalString = z.preprocess(
  v => (v === '' ? null : v),
  z.string().nullable()
);

const optionalUuid = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : v),
  z.string().uuid().nullable()
);

const csvList = z.preprocess(v => {
  if (v === '' || v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}, z.array(z.string()));

// ─── Templates ─────────────────────────────────────────────────────────────

const NewTemplateSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: optionalString,
  applies_to: z.string().min(1).max(60).default('custom'),
  system_md: z.string().default(''),
  user_md_template: z.string().default(''),
  default_model: z.string().min(1).default('claude-sonnet-4-5-20250929'),
});

export async function createTemplate(formData: FormData) {
  const parsed = NewTemplateSchema.parse({
    slug: slugify(String(formData.get('slug') ?? formData.get('name') ?? '')),
    name: formData.get('name'),
    description: formData.get('description'),
    applies_to: formData.get('applies_to') || 'custom',
    system_md: formData.get('system_md') ?? '',
    user_md_template: formData.get('user_md_template') ?? '',
    default_model:
      formData.get('default_model') || 'claude-sonnet-4-5-20250929',
  });
  const inserted = await qOne<{ slug: string }>(
    `insert into voice.prompt_templates
       (slug, name, description, applies_to, system_md, user_md_template, default_model)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning slug`,
    [
      parsed.slug,
      parsed.name,
      parsed.description,
      parsed.applies_to,
      parsed.system_md,
      parsed.user_md_template,
      parsed.default_model,
    ]
  );
  if (!inserted) throw new Error('Failed to create template');
  revalidatePath('/voice/templates');
  revalidatePath('/voice');
  redirect(`/voice/templates/${inserted.slug}`);
}

const UpdateTemplateSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: optionalString,
  applies_to: z.string().min(1).max(60),
  system_md: z.string().default(''),
  user_md_template: z.string().default(''),
  default_model: z.string().min(1),
});

export async function updateTemplate(formData: FormData) {
  const parsed = UpdateTemplateSchema.parse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    description: formData.get('description'),
    applies_to: formData.get('applies_to'),
    system_md: formData.get('system_md') ?? '',
    user_md_template: formData.get('user_md_template') ?? '',
    default_model: formData.get('default_model'),
  });
  await q(
    `update voice.prompt_templates
        set name = $1,
            description = $2,
            applies_to = $3,
            system_md = $4,
            user_md_template = $5,
            default_model = $6
      where slug = $7`,
    [
      parsed.name,
      parsed.description,
      parsed.applies_to,
      parsed.system_md,
      parsed.user_md_template,
      parsed.default_model,
      parsed.slug,
    ]
  );
  revalidatePath(`/voice/templates/${parsed.slug}`);
  revalidatePath('/voice/templates');
  revalidatePath('/voice');
}

export async function archiveTemplate(formData: FormData) {
  const slug = z.string().parse(formData.get('slug'));
  await q(`update voice.prompt_templates set archived = true where slug = $1`, [
    slug,
  ]);
  revalidatePath('/voice/templates');
  revalidatePath(`/voice/templates/${slug}`);
}

export async function unarchiveTemplate(formData: FormData) {
  const slug = z.string().parse(formData.get('slug'));
  await q(
    `update voice.prompt_templates set archived = false where slug = $1`,
    [slug]
  );
  revalidatePath('/voice/templates');
  revalidatePath(`/voice/templates/${slug}`);
}

// ─── Brand briefs ──────────────────────────────────────────────────────────

const NewBriefSchema = z.object({
  client_id: optionalUuid,
  body_md: z.string().default(''),
  do_list: csvList,
  dont_list: csvList,
  sample_copy: optionalString,
});

export async function createBrief(formData: FormData) {
  const parsed = NewBriefSchema.parse({
    client_id: formData.get('client_id'),
    body_md: formData.get('body_md') ?? '',
    do_list: formData.get('do_list'),
    dont_list: formData.get('dont_list'),
    sample_copy: formData.get('sample_copy'),
  });
  // Compute next version: max(version) + 1 for this client_id, scoped so a
  // null client_id has its own sequence.
  const v = await qOne<{ next_version: number }>(
    `select coalesce(max(version), 0) + 1 as next_version
       from voice.brand_briefs
      where ${parsed.client_id ? 'client_id = $1' : 'client_id is null'}`,
    parsed.client_id ? [parsed.client_id] : []
  );
  const nextVersion = v?.next_version ?? 1;
  await q(
    `insert into voice.brand_briefs
       (client_id, version, body_md, do_list, dont_list, sample_copy)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      parsed.client_id,
      nextVersion,
      parsed.body_md,
      parsed.do_list,
      parsed.dont_list,
      parsed.sample_copy,
    ]
  );
  revalidatePath('/voice/briefs');
  revalidatePath('/voice');
  if (parsed.client_id) {
    revalidatePath(`/voice/briefs/${parsed.client_id}`);
    redirect(`/voice/briefs/${parsed.client_id}`);
  } else {
    redirect('/voice/briefs');
  }
}

// ─── Glossary ──────────────────────────────────────────────────────────────

const NewGlossarySchema = z.object({
  client_id: optionalUuid,
  kind: z.enum(GLOSSARY_KINDS as [(typeof GLOSSARY_KINDS)[number], ...typeof GLOSSARY_KINDS]),
  text: z.string().min(1).max(200),
  replacement: optionalString,
  note: optionalString,
});

export async function createGlossaryEntry(formData: FormData) {
  const parsed = NewGlossarySchema.parse({
    client_id: formData.get('client_id'),
    kind: formData.get('kind'),
    text: formData.get('text'),
    replacement: formData.get('replacement'),
    note: formData.get('note'),
  });
  await q(
    `insert into voice.glossary (client_id, kind, text, replacement, note)
     values ($1, $2, $3, $4, $5)`,
    [
      parsed.client_id,
      parsed.kind,
      parsed.text,
      parsed.replacement,
      parsed.note,
    ]
  );
  revalidatePath('/voice/settings/glossary');
}

export async function archiveGlossaryEntry(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`delete from voice.glossary where id = $1`, [id]);
  revalidatePath('/voice/settings/glossary');
}

// ─── Service tokens ────────────────────────────────────────────────────────

const KNOWN_SCOPES = ['llm:run', 'llm:structured'] as const;

const IssueTokenSchema = z.object({
  label: z.string().min(1).max(80),
  scopes: z.array(z.enum(KNOWN_SCOPES)).min(1),
});

/**
 * Issue a new service token. Returns the unhashed value ONCE — the caller
 * (a server-action wrapper) must surface it to the user immediately.
 */
export async function issueServiceToken(
  formData: FormData
): Promise<{ token: string; id: string }> {
  // FormData with multiple "scopes" entries comes as repeated keys.
  const scopes = formData.getAll('scopes').map(String);
  const parsed = IssueTokenSchema.parse({
    label: formData.get('label'),
    scopes,
  });
  const token = generateToken();
  const hash = hashToken(token);
  const inserted = await qOne<{ id: string }>(
    `insert into voice.service_tokens (label, token_hash, scopes)
     values ($1, $2, $3)
     returning id`,
    [parsed.label, hash, parsed.scopes]
  );
  if (!inserted) throw new Error('Failed to issue token');
  revalidatePath('/voice/settings/service-tokens');
  return { token, id: inserted.id };
}

export async function revokeServiceToken(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(
    `update voice.service_tokens set revoked_at = now() where id = $1`,
    [id]
  );
  revalidatePath('/voice/settings/service-tokens');
}

// ─── Playground ────────────────────────────────────────────────────────────

const PlaygroundSchema = z.object({
  template_slug: z.string().min(1),
  client_id: optionalUuid,
  vars_json: z.string().default('{}'),
});

export interface PlaygroundResult {
  ok: boolean;
  output: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_cents: number;
  latency_ms: number;
  run_id: string;
  status: 'ok' | 'error' | 'stub';
  error?: string;
  template_name: string;
  resolved_system: string;
  resolved_user: string;
}

export async function runPlaygroundPrompt(
  formData: FormData
): Promise<PlaygroundResult> {
  const parsed = PlaygroundSchema.parse({
    template_slug: formData.get('template_slug'),
    client_id: formData.get('client_id'),
    vars_json: formData.get('vars_json') ?? '{}',
  });
  let vars: Record<string, string> = {};
  try {
    const raw = JSON.parse(parsed.vars_json) as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        vars[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }
  } catch {
    throw new Error('vars_json must be a valid JSON object.');
  }
  vars = await injectBrandBrief(parsed.client_id, vars);
  vars = await injectGlossary(parsed.client_id, vars);

  const resolved = await resolveTemplate(parsed.template_slug, vars);
  try {
    const result = await runPrompt({
      system: resolved.system,
      user: resolved.user,
      model: resolved.defaultModel,
    });
    const status: 'ok' | 'stub' =
      result.model === 'stub' ? 'stub' : 'ok';
    const run = await insertRun({
      prompt_template_id: resolved.templateId,
      prompt_slug: resolved.templateSlug,
      client_id: parsed.client_id,
      person_id: null,
      calling_app: 'voice',
      input_json: { vars, system: resolved.system, user: resolved.user },
      output: result.output,
      output_json: null,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_cents: result.costCents,
      latency_ms: result.latencyMs,
      used_in: 'playground',
      status,
      error: null,
    });
    revalidatePath('/voice/runs');
    revalidatePath('/voice');
    return {
      ok: true,
      output: result.output,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_cents: result.costCents,
      latency_ms: result.latencyMs,
      run_id: run.id,
      status,
      template_name: resolved.templateName,
      resolved_system: resolved.system,
      resolved_user: resolved.user,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const run = await insertRun({
      prompt_template_id: resolved.templateId,
      prompt_slug: resolved.templateSlug,
      client_id: parsed.client_id,
      person_id: null,
      calling_app: 'voice',
      input_json: { vars, system: resolved.system, user: resolved.user },
      output: null,
      output_json: null,
      model: resolved.defaultModel,
      tokens_in: 0,
      tokens_out: 0,
      cost_cents: 0,
      latency_ms: 0,
      used_in: 'playground',
      status: 'error',
      error: message,
    });
    revalidatePath('/voice/runs');
    return {
      ok: false,
      output: '',
      model: resolved.defaultModel,
      tokens_in: 0,
      tokens_out: 0,
      cost_cents: 0,
      latency_ms: 0,
      run_id: run.id,
      status: 'error',
      error: message,
      template_name: resolved.templateName,
      resolved_system: resolved.system,
      resolved_user: resolved.user,
    };
  }
}
