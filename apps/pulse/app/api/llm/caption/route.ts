import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runPrompt } from '@/lib/social/voice-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  draft: z.string().default(''),
  notes: z.string().default(''),
  client_id: z.string().uuid().nullable().optional(),
  used_in: z.string().nullable().optional(),
});

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
    template_slug: 'post-caption',
    vars: {
      draft: body.draft,
      notes: body.notes,
    },
    client_id: body.client_id ?? null,
    used_in: body.used_in ?? 'social.caption-helper',
  });

  const variants = splitVariants(result.output);

  return NextResponse.json({
    ok: result.ok,
    variants,
    raw: result.output,
    stub: 'stub' in result && result.stub === true,
    model: result.model,
    run_id: result.run_id,
    error: result.ok ? null : result.error ?? null,
  });
}

/**
 * The post-caption template's system prompt asks for "exactly 3 caption
 * variants ranked by your confidence, each on its own line, no numbering."
 * We split on blank lines first (in case the model uses paragraph breaks),
 * then on newlines, and trim aggressively. We never silently drop content
 * — if Claude returned 4 lines we keep all 4.
 */
function splitVariants(text: string): string[] {
  if (!text) return [];
  const blocks = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (blocks.length >= 2) return blocks;
  return text
    .split('\n')
    .map(s => s.replace(/^[\s\d).:-]+/, '').trim())
    .filter(Boolean);
}
