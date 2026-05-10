import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Plug, RefreshCw } from 'lucide-react';
import { getClientByPlatformSlug } from '@/lib/analytics/social-bridge';
import {
  latestInsightForClient,
  listAccountMetricsLastNDays,
  listAccountsWithLatestMetrics,
  listGa4MetricsForClient,
  proposedRecsForClient,
} from '@/lib/analytics/queries';
import { Markdown } from '@/components/analytics/markdown';
import { Sparkline } from '@/components/analytics/sparkline';
import { RecommendationCard } from '@/components/analytics/recommendation-card';
import { formatNumber, formatPct, timeAgo } from '@/lib/analytics/format';

interface Props {
  params: Promise<{ slug: string }>;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[client page] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function ClientPerformanceHome({ params }: Props) {
  const { slug } = await params;
  const client = await getClientByPlatformSlug(slug);
  if (!client) return notFound();

  const [accounts, insight, recs, ga4] = await Promise.all([
    safe(() => listAccountsWithLatestMetrics(client.id), [] as Awaited<ReturnType<typeof listAccountsWithLatestMetrics>>),
    safe(() => latestInsightForClient(client.id), null),
    safe(() => proposedRecsForClient(client.id, 5), [] as Awaited<ReturnType<typeof proposedRecsForClient>>),
    safe(() => listGa4MetricsForClient(client.id, 28), [] as Awaited<ReturnType<typeof listGa4MetricsForClient>>),
  ]);

  // Aggregate sparklines: combine all IG/FB accounts to show one strip.
  const igAccounts = accounts.filter(a => a.platform === 'instagram' || a.platform === 'facebook');
  const sparkData = await Promise.all(
    igAccounts.map(a =>
      safe(() => listAccountMetricsLastNDays(a.id, 28), [] as Awaited<ReturnType<typeof listAccountMetricsLastNDays>>)
    )
  );
  const merged = mergeDailyMetrics(sparkData.flat());

  const ga4Sessions = ga4.reduce((sum, r) => sum + (r.sessions ?? 0), 0);
  const ga4Users = ga4.reduce((sum, r) => sum + (r.users ?? 0), 0);
  const ga4Conv = ga4.reduce((sum, r) => sum + (r.conversions ?? 0), 0);
  const ga4Top = topGa4Source(ga4);

  return (
    <div className="flex flex-col gap-10">
      <Hero name={client.name} slug={slug} />

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">AI · latest insight</span>
            <span className="chip-amber">AI</span>
          </div>
          {insight ? (
            <div className="mt-3">
              <Markdown text={insight.body_md} />
              <div className="mt-3 text-[11px] uppercase tracking-eyebrow text-charcoal/45">
                Generated {timeAgo(insight.generated_at)} · period{' '}
                {insight.period_start} → {insight.period_end}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-charcoal/65">
              No insight yet. The daily insight cron will generate one as data accumulates.
            </p>
          )}
        </div>

        <div className="panel-quiet p-5">
          <span className="eyebrow">Trend · 28 days</span>
          <div className="mt-3 flex flex-col gap-4">
            <SparkRow
              label="Reach"
              values={merged.map(m => m.reach)}
              accent="amber"
            />
            <SparkRow
              label="Followers"
              values={merged.map(m => m.followers)}
              accent="green"
            />
            <SparkRow
              label="Engagement rate"
              values={merged.map(m =>
                m.reach && m.reach > 0 ? (m.likes ?? 0) / m.reach : null
              )}
              accent="amber"
              format="pct"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">AI recommendations</span>
          <Link
            href={`/clients/${slug}/performance/posts`}
            className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
          >
            See post matrix <ArrowRight size={12} className="inline" />
          </Link>
        </div>
        {recs.length === 0 ? (
          <p className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
            No proposed recommendations right now. Run the recommendation cron or wait for
            the next 14:00 UTC tick.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {recs.map(r => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        )}
      </section>

      {ga4.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">GA4 · 28 days</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPI label="Sessions" value={formatNumber(ga4Sessions)} />
            <KPI label="Users" value={formatNumber(ga4Users)} />
            <KPI label="Conversions" value={formatNumber(ga4Conv)} accent="amber" />
            <KPI label="Top source" value={ga4Top ?? '—'} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Connected accounts</span>
          <Link
            href="/analytics/integrations"
            className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
          >
            Manage integrations <ArrowRight size={12} className="inline" />
          </Link>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
            No platforms connected for this client yet.{' '}
            <Link href="/analytics/integrations" className="underline">
              Connect one →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map(a => (
              <div
                key={a.id}
                className="rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="chip-cream uppercase">{a.platform}</span>
                  <span
                    className={
                      a.status === 'connected'
                        ? 'chip-green'
                        : a.status === 'error'
                        ? 'chip-bad'
                        : 'chip-cream'
                    }
                  >
                    {a.status}
                  </span>
                </div>
                <div className="mt-2 font-display text-lg font-bold text-green-deep">
                  {a.handle ?? '—'}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                  Last sync {timeAgo(a.last_synced_at)}
                </div>
                {a.last_error && (
                  <div className="mt-2 text-[11px] text-bad">
                    {a.last_error.slice(0, 200)}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] tabular-nums text-charcoal/65">
                    {formatNumber(a.latest_followers)} followers
                  </span>
                  {a.platform !== 'ga4' && (
                    <Link
                      href={`/api/integrations/meta/connect?client_id=${a.client_id}`}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
                    >
                      <RefreshCw size={11} /> Reconnect
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href={`/clients/${slug}/performance/ask`} className="btn-primary">
          Ask the data
        </Link>
        <Link href={`/clients/${slug}/performance/posts`} className="btn-secondary">
          Open post matrix
        </Link>
        <Link href="/analytics/integrations" className="btn-ghost">
          <Plug size={14} /> Manage integrations
        </Link>
      </section>
    </div>
  );
}

function Hero({ name, slug }: { name: string; slug: string }) {
  return (
    <section className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-10 text-cream shadow-card">
      <span
        aria-hidden
        className="watermark cream pointer-events-none absolute -bottom-6 right-4 text-[140px] leading-none"
      >
        {name.slice(0, 3).toUpperCase()}
      </span>
      <span className="eyebrow cream">Client · performance</span>
      <h1 className="mt-3 font-display text-5xl font-bold tracking-display">
        {name}<span className="italic-amber">.</span>
      </h1>
      <p className="mt-2 text-sm text-cream/65">
        Performance, insights and recommendations · slug{' '}
        <span className="font-mono">{slug}</span>
      </p>
    </section>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">{label}</div>
      <div
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          accent === 'amber' ? 'italic-amber' : 'text-green-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SparkRow({
  label,
  values,
  accent,
  format,
}: {
  label: string;
  values: Array<number | null>;
  accent: 'amber' | 'green';
  format?: 'pct';
}) {
  const last = [...values].reverse().find(v => v !== null && v !== undefined) ?? null;
  const stroke = accent === 'amber' ? '#c96f1f' : '#27452b';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-eyebrow text-charcoal/55">
          {label}
        </span>
        <span
          className={`font-display text-base font-bold tabular-nums ${
            accent === 'amber' ? 'italic-amber' : 'text-green-deep'
          }`}
        >
          {format === 'pct' ? formatPct(last) : formatNumber(last)}
        </span>
      </div>
      <div className="mt-1">
        <Sparkline values={values} stroke={stroke} />
      </div>
    </div>
  );
}

interface MergedRow {
  date: string;
  reach: number | null;
  followers: number | null;
  likes: number | null;
}

function mergeDailyMetrics(
  rows: Array<{
    date: string;
    reach: number | null;
    followers: number | null;
    impressions: number | null;
  }>
): MergedRow[] {
  const map = new Map<string, MergedRow>();
  for (const r of rows) {
    const cur = map.get(r.date) ?? {
      date: r.date,
      reach: null,
      followers: null,
      likes: null,
    };
    cur.reach = sumOrNull(cur.reach, r.reach);
    cur.followers = maxOrNull(cur.followers, r.followers);
    map.set(r.date, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function sumOrNull(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}
function maxOrNull(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return Math.max(a ?? 0, b ?? 0);
}

function topGa4Source(rows: Array<{ top_source_json: unknown }>): string | null {
  for (const r of [...rows].reverse()) {
    const ts = r.top_source_json as Array<{ source: string; sessions: number }> | null | undefined;
    if (Array.isArray(ts) && ts.length > 0) {
      return ts[0].source;
    }
  }
  return null;
}
