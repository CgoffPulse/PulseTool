'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, qOne } from '../db';
import {
  insertInsight,
  insertRecommendation,
  insertSavedChart,
  latestInsightForClient,
  listAccountMetricsLastNDays,
  listAccountsForClient,
  listGa4MetricsForClient,
  listPostsForClient,
  listUntaggedPosts,
  upsertPlatformAccount,
  upsertPostTag,
} from './queries';
import { runPrompt, runStructured } from './voice-gateway';
import type {
  ChartSpec,
  RecommendationStructured,
  TagPostStructured,
} from './types';
import { createDraftPostFromRec, getClientById } from './social-bridge';

const idSchema = z.string().uuid();

// ─── Connect a GA4 property by pasting an ID ───────────────────────────────

const ConnectGa4Schema = z.object({
  client_id: z.string().uuid(),
  property_id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z0-9_:-]+$/),
});

export async function connectGa4Property(formData: FormData) {
  const parsed = ConnectGa4Schema.parse({
    client_id: formData.get('client_id'),
    property_id: formData.get('property_id'),
  });
  await upsertPlatformAccount({
    client_id: parsed.client_id,
    platform: 'ga4',
    handle: parsed.property_id,
    external_id: parsed.property_id,
    access_token_ref: 'GA4_SERVICE_ACCOUNT_B64',
    status: 'connected',
  });
  revalidatePath('/analytics/integrations');
}

// ─── CSV import ────────────────────────────────────────────────────────────

const RunImportSchema = z.object({
  client_id: z.string().uuid(),
  csv: z.string().min(10).max(2_000_000),
});

interface ImportResult {
  ok: boolean;
  inserted: number;
  format: 'instagram' | 'facebook' | 'unknown';
  message: string;
}

export async function runImportCsv(formData: FormData): Promise<ImportResult> {
  const parsed = RunImportSchema.parse({
    client_id: formData.get('client_id'),
    csv: formData.get('csv'),
  });

  const accounts = await listAccountsForClient(parsed.client_id);
  const lines = parsed.csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { ok: false, inserted: 0, format: 'unknown', message: 'CSV is empty.' };
  }

  const header = lines[0].toLowerCase();
  let format: 'instagram' | 'facebook' | 'unknown' = 'unknown';
  if (header.includes('reach') && header.includes('impressions') && header.includes('date')) {
    format = 'instagram';
  } else if (header.includes('lifetime') || header.includes('page')) {
    format = 'facebook';
  }
  if (format === 'unknown') {
    return {
      ok: false,
      inserted: 0,
      format,
      message: 'Unrecognized CSV format. Expected an IG or FB account export.',
    };
  }

  const headers = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const dateIdx = idx('date');
  const reachIdx = idx('reach');
  const impressionsIdx = idx('impressions');
  const followersIdx = headers.findIndex(h => h.includes('follower'));
  const profileIdx = headers.findIndex(h => h.includes('profile') && h.includes('visit'));

  const targetAccount = accounts.find(a => a.platform === format) ?? null;
  if (!targetAccount) {
    return {
      ok: false,
      inserted: 0,
      format,
      message: `No ${format} account connected for this client. Connect one first.`,
    };
  }

  let inserted = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    if (cols.length === 0) continue;
    const dateRaw = (cols[dateIdx] ?? '').trim();
    if (!dateRaw) continue;
    const date = normalizeDate(dateRaw);
    if (!date) continue;

    await q(
      `insert into analytics.account_metrics_daily
         (account_id, date, followers, reach, impressions, profile_visits, raw)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       on conflict (account_id, date) do update set
         followers = coalesce(excluded.followers, analytics.account_metrics_daily.followers),
         reach = coalesce(excluded.reach, analytics.account_metrics_daily.reach),
         impressions = coalesce(excluded.impressions, analytics.account_metrics_daily.impressions),
         profile_visits = coalesce(excluded.profile_visits, analytics.account_metrics_daily.profile_visits),
         raw = coalesce(excluded.raw, analytics.account_metrics_daily.raw)`,
      [
        targetAccount.id,
        date,
        followersIdx >= 0 ? toNum(cols[followersIdx]) : null,
        reachIdx >= 0 ? toNum(cols[reachIdx]) : null,
        impressionsIdx >= 0 ? toNum(cols[impressionsIdx]) : null,
        profileIdx >= 0 ? toNum(cols[profileIdx]) : null,
        JSON.stringify({ csv_row: cols, csv_headers: headers }),
      ]
    );
    inserted++;
  }

  revalidatePath('/analytics/import');
  // The per-client analytics view lives at /clients/[slug]/performance under
  // the (analytics) route group; the /clients/[slug] root is owned by command.
  revalidatePath(`/clients/${parsed.client_id}/performance`);

  return {
    ok: true,
    inserted,
    format,
    message: `Inserted ${inserted} day rows into ${format} account.`,
  };
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[,\s%$]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // try MM/DD/YYYY
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // try Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ─── Ask the data ──────────────────────────────────────────────────────────

const AskSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  question: z.string().min(3).max(500),
});

export interface AskResult {
  ok: boolean;
  spec: ChartSpec | null;
  stub: boolean;
  error?: string;
}

export async function askDataQuestion(formData: FormData): Promise<AskResult> {
  const parsed = AskSchema.parse({
    client_id: formData.get('client_id') || null,
    question: formData.get('question'),
  });

  // Build a tiny dataset preview the gateway can reference.
  const preview: Array<Record<string, unknown>> = [];
  if (parsed.client_id) {
    try {
      const accounts = await listAccountsForClient(parsed.client_id);
      for (const a of accounts.slice(0, 4)) {
        const rows = await listAccountMetricsLastNDays(a.id, 14);
        for (const r of rows.slice(-7)) {
          preview.push({
            account: a.handle ?? a.platform,
            date: r.date,
            reach: r.reach,
            impressions: r.impressions,
            followers: r.followers,
          });
        }
      }
    } catch (err) {
      console.warn('[askDataQuestion] preview fetch failed', (err as Error).message);
    }
  }

  const result = await runStructured<ChartSpec>({
    template_slug: 'analytics-chart-pick',
    output_schema_name: 'analytics.chart_pick',
    client_id: parsed.client_id ?? null,
    used_in: 'ask',
    vars: {
      question: parsed.question,
      columns: 'date, account, reach, impressions, followers, sessions, users, conversions',
      preview: JSON.stringify(preview).slice(0, 4000),
    },
  });

  return {
    ok: result.ok,
    spec: result.data,
    stub: !!result.stub,
    error: !result.ok ? result.error : undefined,
  };
}

const PinChartSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  prompt: z.string().min(3).max(500),
  spec_json: z.string().min(2),
});

export async function pinChart(formData: FormData): Promise<{ ok: boolean }> {
  const parsed = PinChartSchema.parse({
    client_id: formData.get('client_id') || null,
    prompt: formData.get('prompt'),
    spec_json: formData.get('spec_json'),
  });
  let spec: unknown;
  try {
    spec = JSON.parse(parsed.spec_json);
  } catch {
    return { ok: false };
  }
  await insertSavedChart({
    client_id: parsed.client_id ?? null,
    prompt: parsed.prompt,
    chart_spec_json: spec,
  });
  // The Ask page lives at /clients/[slug]/performance/ask under the
  // (analytics) route group. We revalidate by client_id since the slug
  // would require an extra round-trip.
  if (parsed.client_id) {
    revalidatePath(`/clients/${parsed.client_id}/performance/ask`);
  }
  return { ok: true };
}

// ─── Recommendations ───────────────────────────────────────────────────────

const AcceptSchema = z.object({ id: z.string().uuid() });

export async function acceptRecommendation(formData: FormData) {
  const { id } = AcceptSchema.parse({ id: formData.get('id') });
  const rec = await qOne<{ id: string; client_id: string; title: string; rationale_md: string }>(
    `select id, client_id, title, rationale_md from analytics.recommendations where id = $1`,
    [id]
  );
  if (!rec) return;
  const draft = await createDraftPostFromRec({
    client_id: rec.client_id,
    title: rec.title,
    rationale: rec.rationale_md,
  });
  await q(
    `update analytics.recommendations
        set status = 'accepted', accepted_at = now(), target_post_id = $2
      where id = $1`,
    [rec.id, draft?.id ?? null]
  );
  revalidatePath('/analytics/recommendations');
  revalidatePath(`/clients`);
}

const DismissSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(120),
});

export async function dismissRecommendation(formData: FormData) {
  const parsed = DismissSchema.parse({
    id: formData.get('id'),
    reason: formData.get('reason'),
  });
  await q(
    `update analytics.recommendations
        set status = 'dismissed', dismissed_at = now(), dismissed_reason = $2
      where id = $1`,
    [parsed.id, parsed.reason]
  );
  revalidatePath('/analytics/recommendations');
  revalidatePath(`/clients`);
}

// ─── Manual retag / regen ──────────────────────────────────────────────────

const RetagSchema = z.object({ client_id: z.string().uuid() });

export async function retagPostsForClient(formData: FormData): Promise<{ tagged: number }> {
  const { client_id } = RetagSchema.parse({ client_id: formData.get('client_id') });
  const accounts = await listAccountsForClient(client_id);
  const accountIds = new Set(accounts.map(a => a.id));
  let tagged = 0;
  const untagged = await listUntaggedPosts(50);
  for (const p of untagged) {
    if (!accountIds.has(p.account_id)) continue;
    const r = await runStructured<TagPostStructured>({
      template_slug: 'analytics-tag-post',
      output_schema_name: 'analytics.tag_post',
      client_id,
      used_in: `posts_external:${p.id}`,
      vars: {
        caption: (p.caption ?? '').slice(0, 1500),
        media_type: p.media_type ?? 'unknown',
        metrics: '',
      },
    });
    if (r.ok || r.stub) {
      await upsertPostTag({
        posts_external_id: p.id,
        tag_kind: 'pillar',
        tag_value: r.data.pillar,
        confidence: 1,
        source: 'ai',
        run_id: r.run_id,
      });
      await upsertPostTag({
        posts_external_id: p.id,
        tag_kind: 'hook_style',
        tag_value: r.data.hook_style,
        confidence: 1,
        source: 'ai',
        run_id: r.run_id,
      });
      tagged++;
    }
  }
  revalidatePath(`/clients/${client_id}/performance`);
  return { tagged };
}

const RegenSchema = z.object({ client_id: z.string().uuid() });

export async function regenerateInsightForClient(
  formData: FormData
): Promise<{ ok: boolean; stub: boolean }> {
  const { client_id } = RegenSchema.parse({ client_id: formData.get('client_id') });
  const client = await getClientById(client_id);
  if (!client) return { ok: false, stub: false };

  const accounts = await listAccountsForClient(client_id);
  const accountSummaries: unknown[] = [];
  for (const a of accounts.slice(0, 6)) {
    const rows = await listAccountMetricsLastNDays(a.id, 28);
    if (rows.length === 0) continue;
    const last = rows[rows.length - 1];
    accountSummaries.push({
      handle: a.handle,
      platform: a.platform,
      latest_followers: last?.followers ?? null,
      latest_reach: last?.reach ?? null,
      window_days: rows.length,
    });
  }
  const ga4 = await listGa4MetricsForClient(client_id, 28);
  const posts = await listPostsForClient(client_id, 28);
  const period_end = new Date();
  const period_start = new Date(period_end.getTime() - 28 * 86_400_000);

  const r = await runPrompt({
    template_slug: 'analytics-insight',
    client_id,
    used_in: `client:${client_id}`,
    vars: {
      brand_brief: `Client: ${client.name}`,
      metrics: JSON.stringify({ accounts: accountSummaries, ga4: ga4.slice(-7) }).slice(0, 6000),
      posts: JSON.stringify(
        posts.slice(0, 25).map(p => ({
          id: p.id,
          caption: (p.caption ?? '').slice(0, 200),
          reach: p.m_reach,
          likes: p.m_likes,
          saves: p.m_saves,
          shares: p.m_shares,
        }))
      ).slice(0, 6000),
    },
  });

  await insertInsight({
    client_id,
    period_start: period_start.toISOString().slice(0, 10),
    period_end: period_end.toISOString().slice(0, 10),
    body_md: r.ok ? r.output : `[stub] ${r.output}`,
    evidence_post_ids: posts.slice(0, 3).map(p => p.id),
    run_id: r.ok ? r.run_id : null,
  });

  revalidatePath(`/clients/${client.slug}/performance`);
  return { ok: true, stub: !!r.stub };
}

// ─── Insert recommendations from voice gateway output ─────────────────────

export async function generateRecsForClient(
  clientId: string
): Promise<{ inserted: number; stub: boolean }> {
  const client = await getClientById(clientId);
  if (!client) return { inserted: 0, stub: false };

  const insight = await latestInsightForClient(clientId);
  const posts = await listPostsForClient(clientId, 28);

  const r = await runStructured<RecommendationStructured>({
    template_slug: 'analytics-recommendation',
    output_schema_name: 'analytics.recommendation',
    client_id: clientId,
    used_in: `client:${clientId}`,
    vars: {
      brand_brief: `Client: ${client.name}`,
      latest_insight: insight?.body_md ?? '',
      recent_posts: JSON.stringify(
        posts.slice(0, 20).map(p => ({
          id: p.id,
          caption: (p.caption ?? '').slice(0, 200),
          reach: p.m_reach,
          saves: p.m_saves,
          shares: p.m_shares,
        }))
      ).slice(0, 6000),
    },
  });

  let inserted = 0;
  const validKinds = new Set([
    'new_post',
    'repeat_post',
    'change_format',
    'change_cadence',
    'pillar_rebalance',
    'audience_test',
  ]);
  for (const action of r.data.actions ?? []) {
    if (!validKinds.has(action.kind)) continue;
    await insertRecommendation({
      client_id: clientId,
      kind: action.kind,
      title: action.title.slice(0, 120),
      rationale_md: action.rationale_md.slice(0, 4000),
      evidence_post_ids: (action.evidence_post_ids ?? []).filter(uuid =>
        idSchema.safeParse(uuid).success
      ),
      run_id: r.ok ? r.run_id : null,
    });
    inserted++;
  }
  return { inserted, stub: !!r.stub };
}

// ─── Manual redirect helper ────────────────────────────────────────────────

export async function goToClient(formData: FormData) {
  const slug = z.string().min(1).max(100).parse(formData.get('slug'));
  redirect(`/clients/${slug}/performance`);
}
