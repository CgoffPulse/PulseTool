import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { metaConfigured, pollAccount } from '@/lib/analytics/meta';
import { listConnectedMetaAccounts } from '@/lib/analytics/queries';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const t0 = Date.now();
  if (!metaConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'META_APP_ID/SECRET missing',
      ms: Date.now() - t0,
    });
  }

  let accounts: Awaited<ReturnType<typeof listConnectedMetaAccounts>> = [];
  try {
    accounts = await listConnectedMetaAccounts();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, ms: Date.now() - t0 },
      { status: 500 }
    );
  }

  let totalPosts = 0;
  let totalMetricRows = 0;
  let okCount = 0;
  let errCount = 0;
  for (const a of accounts) {
    try {
      const res = await pollAccount(a);
      totalPosts += res.posts;
      totalMetricRows += res.metric_rows;
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
      console.warn('[cron ingest-meta] account failed', a.id, (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    ok_count: okCount,
    err_count: errCount,
    posts: totalPosts,
    metric_rows: totalMetricRows,
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
