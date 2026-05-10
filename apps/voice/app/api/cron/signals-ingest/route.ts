/**
 * Cron entrypoint — agency-wide signal ingest + auto-task creation.
 *
 * Runs every 10 minutes (vercel.json). Two-phase:
 *   1. ingestSignals()             — pull source-app activity, write
 *                                    idempotent rows into command.signals.
 *   2. processUnhandledSignals()   — convert each `unprocessed` signal
 *                                    into a command.tasks row (origin='signal',
 *                                    keyed on signal_key).
 *
 * Auth: matches the existing Vercel-cron pattern in
 * apps/social/app/api/cron/regenerate-notifications — `Authorization: Bearer
 * ${CRON_SECRET}` OR `x-pulse-cron: ${CRON_SECRET}`. If CRON_SECRET is unset,
 * the route is open (dev convenience).
 */
import { NextResponse } from 'next/server';
import { ingestSignals, processUnhandledSignals } from '@/lib/signals/ingestor';

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
  const ingest = await ingestSignals();
  const process = await processUnhandledSignals();
  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - t0,
    ingested: ingest.ingested,
    deduped: ingest.deduped,
    by_source: ingest.by_source,
    processed: process.processed,
    ignored: process.ignored,
    by_kind: process.by_kind,
    scanned: process.scanned,
  });
}
