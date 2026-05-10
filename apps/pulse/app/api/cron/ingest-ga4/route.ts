import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { ga4Configured, pollProperty } from '@/lib/analytics/ga4';
import { listConnectedGa4Accounts } from '@/lib/analytics/queries';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;
  const t0 = Date.now();

  if (!ga4Configured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'GA4_SERVICE_ACCOUNT_B64 missing',
      ms: Date.now() - t0,
    });
  }

  let accounts: Awaited<ReturnType<typeof listConnectedGa4Accounts>> = [];
  try {
    accounts = await listConnectedGa4Accounts();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, ms: Date.now() - t0 },
      { status: 500 }
    );
  }

  let totalRows = 0;
  let okCount = 0;
  let errCount = 0;
  for (const a of accounts) {
    if (!a.external_id) continue;
    try {
      const res = await pollProperty(a.client_id, a.external_id);
      totalRows += res.rows;
      if (res.ok) {
        okCount++;
        await q(
          `update analytics.platform_accounts
              set last_synced_at = now(), last_error = null
            where id = $1`,
          [a.id]
        );
      } else {
        errCount++;
        await q(
          `update analytics.platform_accounts
              set last_error = $2, status = 'error'
            where id = $1`,
          [a.id, (res.error ?? '').slice(0, 400)]
        );
      }
    } catch (err) {
      errCount++;
      console.warn('[cron ingest-ga4] account failed', a.id, (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    ok_count: okCount,
    err_count: errCount,
    rows: totalRows,
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
