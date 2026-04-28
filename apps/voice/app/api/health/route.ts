import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let db: 'ok' | 'down' = 'ok';
  try {
    await q(`select 1 from voice.prompt_templates limit 1`);
  } catch {
    db = 'down';
  }
  const configured = (key: string) =>
    process.env[key] ? 'configured' : 'missing';
  return NextResponse.json({
    ok: true,
    app: 'pulse-voice',
    db,
    integrations: {
      anthropic: configured('ANTHROPIC_API_KEY'),
      internal_token: configured('VOICE_GATEWAY_INTERNAL_TOKEN'),
      social_url: configured('NEXT_PUBLIC_SOCIAL_URL'),
    },
  });
}
