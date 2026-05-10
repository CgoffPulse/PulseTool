/**
 * Cron entrypoint — auto-close tasks whose artifact-derived predicate fires.
 *
 * Runs every 15 minutes (vercel.json). Scans command.tasks for non-terminal
 * rows with an auto_close_rule, evaluates each rule against current state,
 * and flips matching tasks to done. Zero human writes.
 *
 * Auth: same pattern as signals-ingest.
 */
import { NextResponse } from 'next/server';
import { processAutoCloses } from '@/lib/voice/signals/auto-close';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-pulse-cron') === secret) return true;
  return false;
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const t0 = Date.now();
  const result = await processAutoCloses();
  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - t0,
    scanned: result.scanned,
    closed: result.closed,
    by_rule: result.by_rule,
  });
}
