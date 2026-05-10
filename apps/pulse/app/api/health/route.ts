import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db: 'ok' | 'down' = 'ok';
  try {
    await q(`select 1 from people limit 1`);
  } catch {
    db = 'down';
  }
  const configured = (key: string) => (process.env[key] ? 'configured' : 'missing');
  return NextResponse.json({
    ok: true,
    app: 'pulse-huddle',
    db,
    integrations: {
      social_url: configured('NEXT_PUBLIC_SOCIAL_URL'),
      crm_url: configured('NEXT_PUBLIC_CRM_URL'),
      voice_url: configured('NEXT_PUBLIC_VOICE_URL'),
      analytics_url: configured('NEXT_PUBLIC_ANALYTICS_URL'),
      dev_url: configured('NEXT_PUBLIC_DEV_URL'),
    },
  });
}
