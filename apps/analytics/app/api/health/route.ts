import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db: 'ok' | 'down' = 'ok';
  try {
    await q(`select 1 from analytics.platform_accounts limit 1`);
  } catch {
    db = 'down';
  }
  const configured = (...keys: string[]) =>
    keys.every(k => !!process.env[k]) ? 'configured' : 'missing';

  return NextResponse.json({
    ok: true,
    app: 'pulse-analytics',
    db,
    integrations: {
      meta: configured('META_APP_ID', 'META_APP_SECRET'),
      ga4: configured('GA4_SERVICE_ACCOUNT_B64'),
      voice_gateway: configured('VOICE_GATEWAY_URL', 'VOICE_GATEWAY_TOKEN'),
      cron: configured('CRON_SECRET'),
    },
  });
}
