/**
 * Bearer auth for cron / internal endpoints.
 *
 * Vercel cron jobs send `Authorization: Bearer <CRON_SECRET>` automatically
 * when `CRON_SECRET` is configured on the project. We mirror that contract
 * for any local triggers (e.g. `curl -X POST -H 'Authorization: Bearer …'`).
 *
 * If `CRON_SECRET` is not set we allow the request through (local dev) but
 * emit a single warning so it's obvious in production logs.
 */
export function assertCronAuth(req: Request): Response | void {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.warn(
      '[auth] CRON_SECRET is not set — allowing unauthenticated cron call (dev only)'
    );
    return;
  }

  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  if (header !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
}
