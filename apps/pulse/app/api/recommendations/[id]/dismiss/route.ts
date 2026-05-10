import { NextResponse } from 'next/server';
import { z } from 'zod';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(120),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = Schema.safeParse({
    id,
    reason: (body as { reason?: string })?.reason ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  await q(
    `update analytics.recommendations
        set status = 'dismissed', dismissed_at = now(), dismissed_reason = $2
      where id = $1`,
    [parsed.data.id, parsed.data.reason]
  );
  return NextResponse.json({ ok: true });
}
