import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runPrompt } from '@/lib/social/voice-client';
import type { ContentType, Pillar } from '@/lib/social/types';
import { CONTENT_TYPES } from '@/lib/social/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  pillar_mix: z.string().default(''),
  quotas: z.string().default(''),
  holidays: z.string().default(''),
  notes: z.string().default(''),
  client_id: z.string().uuid().nullable().optional(),
  used_in: z.string().nullable().optional(),
});

export interface DraftedPost {
  post_date: string;
  content_type: ContentType;
  pillar: Pillar | null;
  description: string;
}

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const result = await runPrompt({
    template_slug: 'month-plan-drafter',
    vars: {
      month: body.month,
      pillar_mix: body.pillar_mix,
      quotas: body.quotas,
      holidays: body.holidays,
      notes: body.notes,
    },
    client_id: body.client_id ?? null,
    used_in: body.used_in ?? 'social.month-drafter',
  });

  const drafts = parseDrafts(result.output);

  return NextResponse.json({
    ok: result.ok,
    drafts,
    raw: result.output,
    stub: 'stub' in result && result.stub === true,
    model: result.model,
    run_id: result.run_id,
    error: result.ok ? null : result.error ?? null,
  });
}

const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);
const PILLAR_SET = new Set<Pillar>(['p1', 'p2', 'p3']);

/**
 * The template asks for a bulleted list, one post per line:
 *   `- YYYY-MM-DD content_type · pillar · description`
 *
 * We tolerate light variation: leading bullets (`-`, `*`, `•`), the
 * separator being either `·` or `-` or `|`, and extra whitespace.
 * Lines we can't parse are skipped silently — the modal shows the raw
 * output too, so the user can recover.
 */
export function parseDrafts(text: string): DraftedPost[] {
  if (!text) return [];
  const out: DraftedPost[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/^\s*[-*•]\s*/, '').trim();
    if (!line) continue;
    const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.*)$/);
    if (!dateMatch) continue;
    const [, post_date, rest] = dateMatch;
    const parts = rest.split(/\s*[·|–-]\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const contentTypeRaw = parts[0].toLowerCase();
    if (!CONTENT_TYPE_SET.has(contentTypeRaw)) continue;
    const pillarRaw = parts[1]?.toLowerCase();
    const pillar = pillarRaw && PILLAR_SET.has(pillarRaw as Pillar) ? (pillarRaw as Pillar) : null;
    const description = parts.slice(pillar ? 2 : 1).join(' · ').trim();
    out.push({
      post_date,
      content_type: contentTypeRaw as ContentType,
      pillar,
      description: description || '(no description)',
    });
  }
  return out;
}
