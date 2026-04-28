import 'server-only';
import { q, qOne } from './db';
import type { BrandBrief, GlossaryEntry, PromptTemplate } from './types';

export interface ResolvedTemplate {
  templateId: string;
  templateSlug: string;
  templateName: string;
  defaultModel: string;
  system: string;
  user: string;
}

/**
 * Mustache-lite: replace `{{var}}` with `vars[var]`. Missing vars stay as the
 * literal placeholder so the prompt makes it obvious what wasn't provided.
 */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return typeof v === 'string' ? v : `{{${key}}}`;
  });
}

export async function resolveTemplate(
  slug: string,
  vars: Record<string, string>
): Promise<ResolvedTemplate> {
  const tpl = await qOne<PromptTemplate>(
    `select id, slug, name, description, applies_to, system_md, user_md_template,
            default_model, version, archived, created_by_person_id,
            created_at, updated_at
       from voice.prompt_templates
      where slug = $1 and archived = false
      order by version desc
      limit 1`,
    [slug]
  );
  if (!tpl) {
    throw new Error(`Template not found: ${slug}`);
  }
  return {
    templateId: tpl.id,
    templateSlug: tpl.slug,
    templateName: tpl.name,
    defaultModel: tpl.default_model,
    system: fill(tpl.system_md, vars),
    user: fill(tpl.user_md_template, vars),
  };
}

function renderBriefMarkdown(brief: BrandBrief): string {
  const parts: string[] = [];
  if (brief.body_md.trim()) parts.push(brief.body_md.trim());
  if (brief.do_list.length > 0) {
    parts.push('**Do:**');
    parts.push(brief.do_list.map(item => `- ${item}`).join('\n'));
  }
  if (brief.dont_list.length > 0) {
    parts.push("**Don't:**");
    parts.push(brief.dont_list.map(item => `- ${item}`).join('\n'));
  }
  if (brief.sample_copy && brief.sample_copy.trim()) {
    parts.push('**Sample copy in voice:**');
    parts.push(brief.sample_copy.trim());
  }
  return parts.join('\n\n');
}

/**
 * If `vars.brand_brief` is missing and `clientId` is provided, look up the
 * latest brand brief for the client and inject it as markdown.
 */
export async function injectBrandBrief(
  clientId: string | null | undefined,
  vars: Record<string, string>
): Promise<Record<string, string>> {
  if (vars.brand_brief && vars.brand_brief.trim().length > 0) return vars;
  if (!clientId) return vars;
  const brief = await qOne<BrandBrief>(
    `select id, client_id, version, body_md, do_list, dont_list, sample_copy,
            updated_by_person_id, created_at, updated_at
       from voice.brand_briefs
      where client_id = $1
      order by version desc
      limit 1`,
    [clientId]
  );
  if (!brief) return vars;
  return { ...vars, brand_brief: renderBriefMarkdown(brief) };
}

/**
 * Append a glossary block to `vars.brand_brief`. Banned terms render as
 * `Avoid: "X"`. Preferred replacements render as `Prefer: "Y" (was "X")`.
 */
export async function injectGlossary(
  clientId: string | null | undefined,
  vars: Record<string, string>
): Promise<Record<string, string>> {
  // Always pull global entries; pull client-specific if a client is provided.
  const entries = await q<GlossaryEntry>(
    `select id, client_id, kind::text as kind, text, replacement, note, created_at
       from voice.glossary
      where client_id is null${clientId ? ' or client_id = $1' : ''}
      order by created_at`,
    clientId ? [clientId] : []
  );
  if (entries.length === 0) return vars;
  const lines: string[] = [];
  for (const e of entries) {
    if (e.kind === 'banned') {
      lines.push(`Avoid: "${e.text}"${e.note ? ` (${e.note})` : ''}`);
    } else if (e.kind === 'preferred') {
      lines.push(
        `Prefer: "${e.replacement ?? e.text}"${e.replacement ? ` (was "${e.text}")` : ''}`
      );
    } else {
      // term — definitional, append as a small note.
      lines.push(`Term: "${e.text}"${e.note ? ` — ${e.note}` : ''}`);
    }
  }
  const block = `\n\n**Glossary**\n${lines.join('\n')}`;
  const existing = vars.brand_brief ?? '';
  // Don't double-append if "Glossary" already present.
  if (existing.includes('**Glossary**')) return vars;
  return { ...vars, brand_brief: `${existing}${block}`.trim() };
}
