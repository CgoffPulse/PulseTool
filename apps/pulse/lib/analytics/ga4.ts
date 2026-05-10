import 'server-only';
import { upsertGa4Daily } from './queries';

/**
 * Google Analytics 4 ingest.
 *
 * Uses the GA4 Data API via the Google service account credentials passed in
 * as a base64-encoded JSON blob (`GA4_SERVICE_ACCOUNT_B64`). The lazy import
 * keeps `googleapis` out of the cold-start path on routes that don't need it.
 *
 * Graceful when keys missing: `pollProperty` returns `{ skipped: true }`.
 */

export interface Ga4PollResult {
  ok: boolean;
  skipped?: boolean;
  client_id: string;
  property_id: string;
  rows: number;
  error?: string;
}

export function ga4Configured(): boolean {
  return !!process.env.GA4_SERVICE_ACCOUNT_B64;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    const raw = Buffer.from(b64, 'base64').toString('utf-8');
    const json = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    return {
      client_email: json.client_email,
      private_key: json.private_key.replace(/\\n/g, '\n'),
    };
  } catch (err) {
    console.warn('[ga4] could not parse service account', (err as Error).message);
    return null;
  }
}

interface GoogleAuthLib {
  JWT: new (opts: {
    email: string;
    key: string;
    scopes: string[];
  }) => { authorize: () => Promise<unknown>; getAccessToken: () => Promise<{ token?: string | null }> };
}

async function getAccessToken(): Promise<string | null> {
  const sa = loadServiceAccount();
  if (!sa) return null;
  try {
    const mod = (await import('googleapis')) as { google: { auth: GoogleAuthLib } };
    const jwt = new mod.google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    await jwt.authorize();
    const tok = await jwt.getAccessToken();
    return tok.token ?? null;
  } catch (err) {
    console.warn('[ga4] auth failed', (err as Error).message);
    return null;
  }
}

interface RunReportRow {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
}

interface RunReportBody {
  dimensions?: Array<{ name: string }>;
  metrics?: Array<{ name: string }>;
  dateRanges?: Array<{ startDate: string; endDate: string }>;
  orderBys?: Array<unknown>;
  limit?: string;
}

async function runReport(
  propertyId: string,
  token: string,
  body: RunReportBody
): Promise<{ rows: RunReportRow[] }> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ga4 ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: RunReportRow[] };
  return { rows: json.rows ?? [] };
}

/**
 * Pull last 30 days of session/user/conversion + top source data for the
 * given property. Writes one row per day into analytics.ga4_metrics_daily.
 */
export async function pollProperty(
  clientId: string,
  propertyId: string
): Promise<Ga4PollResult> {
  if (!ga4Configured()) {
    return {
      ok: true,
      skipped: true,
      client_id: clientId,
      property_id: propertyId,
      rows: 0,
      error: 'GA4_SERVICE_ACCOUNT_B64 missing',
    };
  }
  const token = await getAccessToken();
  if (!token) {
    return {
      ok: false,
      client_id: clientId,
      property_id: propertyId,
      rows: 0,
      error: 'auth failed',
    };
  }

  let rows = 0;
  try {
    // Daily metrics
    const daily = await runReport(propertyId, token, {
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      limit: '40',
    });

    // Top sources for the same window — single roll-up, then we tag each
    // daily row with the agency-wide top source for now.
    let topSourceJson: unknown = null;
    try {
      const top = await runReport(propertyId, token, {
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
        limit: '5',
      });
      topSourceJson = (top.rows ?? []).map(r => ({
        source: r.dimensionValues?.[0]?.value ?? 'unknown',
        sessions: Number(r.metricValues?.[0]?.value ?? '0'),
      }));
    } catch (err) {
      console.warn('[ga4] top source failed', (err as Error).message);
    }

    for (const r of daily.rows) {
      const isoDate = (r.dimensionValues?.[0]?.value ?? '').replace(
        /^(\d{4})(\d{2})(\d{2})$/,
        '$1-$2-$3'
      );
      if (!isoDate || isoDate.length !== 10) continue;
      await upsertGa4Daily({
        client_id: clientId,
        date: isoDate,
        sessions: Number(r.metricValues?.[0]?.value ?? '0'),
        users: Number(r.metricValues?.[1]?.value ?? '0'),
        conversions: Number(r.metricValues?.[2]?.value ?? '0'),
        bounce_rate: Number(r.metricValues?.[3]?.value ?? '0'),
        avg_session_seconds: Number(r.metricValues?.[4]?.value ?? '0'),
        top_source_json: topSourceJson,
        raw: r,
      });
      rows++;
    }

    return { ok: true, client_id: clientId, property_id: propertyId, rows };
  } catch (err) {
    return {
      ok: false,
      client_id: clientId,
      property_id: propertyId,
      rows,
      error: (err as Error).message,
    };
  }
}
