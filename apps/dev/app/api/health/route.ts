import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db: 'ok' | 'down' = 'ok';
  try {
    await q(`select 1 from dev.projects limit 1`);
  } catch {
    db = 'down';
  }

  const configured = (key: string) => (process.env[key] ? 'configured' : 'missing');

  return NextResponse.json({
    ok: true,
    db,
    monitors: {
      github: configured('GITHUB_TOKEN'),
      vercel: configured('VERCEL_TOKEN'),
      github_webhook: configured('GITHUB_WEBHOOK_SECRET'),
      vercel_webhook: configured('VERCEL_WEBHOOK_SECRET'),
      cron: configured('CRON_SECRET'),
    },
  });
}
