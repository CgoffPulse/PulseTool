import { NextResponse } from 'next/server';
import { runDetectors } from '@/lib/social/action-engine';
import { loadEngineSnapshot } from '@/lib/social/queries';
import { supabaseServer } from '@/lib/social/supabase/server';
import type { NotificationDraft } from '@/lib/social/types';

/**
 * Cron entrypoint that regenerates the in-app notification feed from the
 * current state of the world.
 *
 * - Runs all detectors → list of NotificationDraft.
 * - Upserts each draft into `notifications` (dedup_key is unique).
 * - Marks any open notification whose dedup_key isn't in the new draft set
 *   as `resolved_at = now()` — i.e. the condition no longer holds.
 *
 * Auth: Vercel cron jobs send `Authorization: Bearer <CRON_SECRET>` when the
 * env var is set. Manual triggers from the UI hit the same endpoint with the
 * `x-pulse-cron` header instead.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured = open (dev convenience)
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-pulse-cron') === secret) return true;
  return false;
}

export async function GET(req: Request) {
  return regenerate(req);
}

export async function POST(req: Request) {
  return regenerate(req);
}

async function regenerate(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const t0 = Date.now();
  const today = new Date();
  const snapshot = await loadEngineSnapshot(today);
  const drafts = runDetectors(snapshot);

  const sb = supabaseServer();

  // 1. Upsert each draft on its dedup_key.
  let upserted = 0;
  if (drafts.length > 0) {
    const rows = drafts.map(toRow);
    const { error } = await sb
      .from('notifications')
      .upsert(rows, { onConflict: 'dedup_key' });
    if (error) throw error;
    upserted = rows.length;
  }

  // 2. Resolve any open notification whose dedup_key isn't in the new set.
  const newKeys = new Set(drafts.map(d => d.dedup_key));
  const { data: openRows, error: listErr } = await sb
    .from('notifications')
    .select('id, dedup_key, dismissed_at, resolved_at')
    .is('dismissed_at', null)
    .is('resolved_at', null);
  if (listErr) throw listErr;
  const stale = (openRows ?? []).filter(r => !newKeys.has(r.dedup_key));
  let resolved = 0;
  if (stale.length) {
    const ids = stale.map(r => r.id);
    const { error } = await sb
      .from('notifications')
      .update({ resolved_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw error;
    resolved = ids.length;
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - t0,
    drafts: drafts.length,
    upserted,
    resolved,
  });
}

function toRow(d: NotificationDraft) {
  return {
    kind: d.kind,
    severity: d.severity,
    dedup_key: d.dedup_key,
    title: d.title,
    detail: d.detail ?? null,
    link_url: d.link_url ?? null,
    audience_role: d.audience_role ?? null,
    audience_person_id: d.audience_person_id ?? null,
    related_post_id: d.related_post_id ?? null,
    related_shoot_id: d.related_shoot_id ?? null,
    related_client_id: d.related_client_id ?? null,
    related_month_id: d.related_month_id ?? null,
    // Re-running on an already-resolved row should re-open it — the detector
    // wouldn't fire again unless the condition is back.
    resolved_at: null,
  };
}
