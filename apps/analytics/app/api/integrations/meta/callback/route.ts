import { NextResponse } from 'next/server';
import { exchangeCodeForToken, listManagedPages } from '@/lib/ingest/meta';
import { upsertPlatformAccount } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';

  let clientId = '';
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const json = JSON.parse(decoded) as { client_id?: string };
    clientId = json.client_id ?? '';
  } catch {
    // ignore
  }
  if (!code || !clientId) {
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent('Missing code or state')}`
    );
  }

  const userToken = await exchangeCodeForToken(code);
  if (!userToken) {
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent('Token exchange failed')}`
    );
  }
  const pages = await listManagedPages(userToken);
  let connected = 0;

  for (const p of pages) {
    try {
      // Store the page-level token under a deterministic env var name. The
      // actual token is *not* persisted in DB — the row only carries a
      // pointer; the operator is expected to copy the token into Vercel env
      // post-OAuth. As a graceful fallback we also write it to a runtime
      // global so this connect+poll cycle works in dev.
      const fbRef = `META_TOKEN_${p.page_id}`;
      await upsertPlatformAccount({
        client_id: clientId,
        platform: 'facebook',
        handle: p.page_name,
        external_id: p.page_id,
        access_token_ref: fbRef,
        status: 'connected',
      });
      // Best-effort: stash the token in this process env for the current
      // serverless instance lifetime. On real prod the operator must paste
      // this into Vercel env to make it durable.
      try {
        process.env[fbRef] = p.page_token;
      } catch {
        // ignore
      }
      connected++;

      if (p.ig_id) {
        const igRef = `META_TOKEN_${p.ig_id}`;
        await upsertPlatformAccount({
          client_id: clientId,
          platform: 'instagram',
          handle: p.ig_username ?? p.page_name,
          external_id: p.ig_id,
          access_token_ref: igRef,
          status: 'connected',
        });
        try {
          process.env[igRef] = p.page_token;
        } catch {
          // ignore
        }
        connected++;
      }
    } catch (err) {
      console.warn('[meta callback] upsert failed', (err as Error).message);
    }
  }

  return NextResponse.redirect(
    `${url.origin}/integrations?connected=${connected}&pages=${pages.length}`
  );
}
