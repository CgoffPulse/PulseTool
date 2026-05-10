import 'server-only';

export interface SisterHealth {
  app: string;
  url: string;
  ok: boolean;
  db: 'ok' | 'down' | 'unknown';
  latencyMs: number;
}

const APPS: Array<{ key: string; envVar: string }> = [
  { key: 'social', envVar: 'NEXT_PUBLIC_SOCIAL_URL' },
  { key: 'dev', envVar: 'NEXT_PUBLIC_DEV_URL' },
  { key: 'crm', envVar: 'NEXT_PUBLIC_CRM_URL' },
  { key: 'voice', envVar: 'NEXT_PUBLIC_VOICE_URL' },
  { key: 'analytics', envVar: 'NEXT_PUBLIC_ANALYTICS_URL' },
];

export async function pingAll(): Promise<SisterHealth[]> {
  return Promise.all(
    APPS.map(async ({ key, envVar }) => {
      const url = (process.env[envVar] ?? '').replace(/\/$/, '');
      const t0 = Date.now();
      if (!url) {
        return { app: key, url: '', ok: false, db: 'unknown' as const, latencyMs: 0 };
      }
      try {
        const res = await fetch(`${url}/api/health`, {
          signal: AbortSignal.timeout(2500),
          cache: 'no-store',
        });
        const latencyMs = Date.now() - t0;
        if (!res.ok) return { app: key, url, ok: false, db: 'unknown' as const, latencyMs };
        const j = (await res.json().catch(() => null)) as
          | { db?: 'ok' | 'down' }
          | null;
        return {
          app: key,
          url,
          ok: true,
          db: (j?.db as 'ok' | 'down' | undefined) ?? 'unknown',
          latencyMs,
        };
      } catch {
        return { app: key, url, ok: false, db: 'unknown' as const, latencyMs: Date.now() - t0 };
      }
    })
  );
}
