import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db: 'ok' | 'down' = 'ok';
  try {
    await q(`select 1 from crm.leads limit 1`);
  } catch {
    db = 'down';
  }
  const configured = (key: string) => (process.env[key] ? 'configured' : 'missing');
  return NextResponse.json({
    ok: true,
    app: 'pulse-crm',
    db,
    integrations: {
      cron: configured('CRON_SECRET'),
      crm_url: configured('NEXT_PUBLIC_CRM_URL'),
      social_url: configured('NEXT_PUBLIC_SOCIAL_URL'),
    },
  });
}
