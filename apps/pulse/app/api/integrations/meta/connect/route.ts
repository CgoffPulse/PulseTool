import { NextResponse } from 'next/server';
import { metaAuthorizeUrl } from '@/lib/analytics/meta';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id') ?? '';
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'client_id required' }, { status: 400 });
  }
  const state = Buffer.from(JSON.stringify({ client_id: clientId, t: Date.now() })).toString(
    'base64url'
  );
  const authUrl = metaAuthorizeUrl(state);
  if (!authUrl) {
    return NextResponse.redirect(
      `${url.origin}/analytics/integrations?error=${encodeURIComponent(
        'Meta keys not configured. Add META_APP_ID and META_APP_SECRET in Vercel env.'
      )}`
    );
  }
  return NextResponse.redirect(authUrl);
}
