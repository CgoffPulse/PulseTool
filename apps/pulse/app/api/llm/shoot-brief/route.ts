import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runPrompt } from '@/lib/social/voice-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  frame: z.string().default(''),
  captures: z.string().default(''),
  linked_posts: z.string().default(''),
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
    template_slug: 'shoot-brief',
    vars: {
      frame: body.frame,
      captures: body.captures,
      linked_posts: body.linked_posts,
    },
    client_id: body.client_id ?? null,
    used_in: body.used_in ?? 'social.shoot-brief',
  });

  return NextResponse.json({
    ok: result.ok,
    brief: result.output,
    stub: 'stub' in result && result.stub === true,
    model: result.model,
    run_id: result.run_id,
    error: result.ok ? null : result.error ?? null,
  });
}
