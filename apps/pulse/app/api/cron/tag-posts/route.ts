import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { listUntaggedPosts, upsertPostTag } from '@/lib/analytics/queries';
import { runStructured } from '@/lib/analytics/voice-gateway';
import type { TagPostStructured } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const t0 = Date.now();
  let tagged = 0;
  let scanned = 0;
  let untagged: Awaited<ReturnType<typeof listUntaggedPosts>> = [];
  try {
    untagged = await listUntaggedPosts(100);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, ms: Date.now() - t0 },
      { status: 500 }
    );
  }

  for (const p of untagged) {
    scanned++;
    try {
      const r = await runStructured<TagPostStructured>({
        template_slug: 'analytics-tag-post',
        output_schema_name: 'analytics.tag_post',
        used_in: `posts_external:${p.id}`,
        vars: {
          caption: (p.caption ?? '').slice(0, 1500),
          media_type: p.media_type ?? 'unknown',
          metrics: '',
        },
      });
      if (r.ok || r.stub) {
        await upsertPostTag({
          posts_external_id: p.id,
          tag_kind: 'pillar',
          tag_value: r.data.pillar,
          confidence: 1,
          source: 'ai',
          run_id: r.run_id,
        });
        await upsertPostTag({
          posts_external_id: p.id,
          tag_kind: 'hook_style',
          tag_value: r.data.hook_style,
          confidence: 1,
          source: 'ai',
          run_id: r.run_id,
        });
        tagged++;
      }
    } catch (err) {
      console.warn('[cron tag-posts] failed for', p.id, (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned,
    tagged,
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
