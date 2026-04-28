import { NextResponse } from 'next/server';
import { z } from 'zod';
import { q, qOne } from '@/lib/db';
import { createDraftPostFromRec } from '@/lib/social-bridge';

export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) {
    return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
  }
  const id = idCheck.data;

  const rec = await qOne<{
    id: string;
    client_id: string;
    title: string;
    rationale_md: string;
    status: string;
  }>(
    `select id, client_id, title, rationale_md, status from analytics.recommendations where id = $1`,
    [id]
  );
  if (!rec) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }
  if (rec.status !== 'proposed') {
    return NextResponse.json({ ok: true, already: rec.status });
  }

  const draft = await createDraftPostFromRec({
    client_id: rec.client_id,
    title: rec.title,
    rationale: rec.rationale_md,
  });
  await q(
    `update analytics.recommendations
        set status = 'accepted', accepted_at = now(), target_post_id = $2
      where id = $1`,
    [id, draft?.id ?? null]
  );

  return NextResponse.json({
    ok: true,
    drafted_post_id: draft?.id ?? null,
    note: draft
      ? 'Draft created on the social side.'
      : 'Recommendation accepted; social schema unreachable so no draft was created.',
  });
}
