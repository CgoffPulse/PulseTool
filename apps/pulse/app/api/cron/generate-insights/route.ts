import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { q } from '@/lib/db';
import {
  insertInsight,
  listAccountMetricsLastNDays,
  listAccountsForClient,
  listGa4MetricsForClient,
  listPostsForClient,
} from '@/lib/analytics/queries';
import { runPrompt } from '@/lib/analytics/voice-gateway';
import { getClientById } from '@/lib/analytics/social-bridge';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;
  const t0 = Date.now();

  let clientIds: string[] = [];
  try {
    const rows = await q<{ client_id: string }>(
      `select distinct client_id from analytics.platform_accounts where status = 'connected'`
    );
    clientIds = rows.map(r => r.client_id);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, ms: Date.now() - t0 },
      { status: 500 }
    );
  }

  let inserted = 0;
  for (const clientId of clientIds) {
    try {
      const client = await getClientById(clientId);
      const accounts = await listAccountsForClient(clientId);
      const accountSummaries: unknown[] = [];
      for (const a of accounts.slice(0, 6)) {
        const rows = await listAccountMetricsLastNDays(a.id, 28);
        if (rows.length === 0) continue;
        const last = rows[rows.length - 1];
        accountSummaries.push({
          handle: a.handle,
          platform: a.platform,
          latest_followers: last?.followers ?? null,
          latest_reach: last?.reach ?? null,
          window_days: rows.length,
        });
      }
      const ga4 = await listGa4MetricsForClient(clientId, 28);
      const posts = await listPostsForClient(clientId, 28);

      const r = await runPrompt({
        template_slug: 'analytics-insight',
        client_id: clientId,
        used_in: `client:${clientId}`,
        vars: {
          brand_brief: `Client: ${client?.name ?? clientId}`,
          metrics: JSON.stringify({ accounts: accountSummaries, ga4: ga4.slice(-7) }).slice(
            0,
            6000
          ),
          posts: JSON.stringify(
            posts.slice(0, 25).map(p => ({
              id: p.id,
              caption: (p.caption ?? '').slice(0, 200),
              reach: p.m_reach,
              likes: p.m_likes,
              saves: p.m_saves,
              shares: p.m_shares,
            }))
          ).slice(0, 6000),
        },
      });

      const period_end = new Date();
      const period_start = new Date(period_end.getTime() - 28 * 86_400_000);

      await insertInsight({
        client_id: clientId,
        period_start: period_start.toISOString().slice(0, 10),
        period_end: period_end.toISOString().slice(0, 10),
        body_md: r.ok ? r.output : `[stub] ${r.output}`,
        evidence_post_ids: posts.slice(0, 3).map(p => p.id),
        run_id: r.ok ? r.run_id : null,
      });
      inserted++;
    } catch (err) {
      console.warn('[cron generate-insights] client failed', clientId, (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    clients: clientIds.length,
    inserted,
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
