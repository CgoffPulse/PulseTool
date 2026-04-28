import Link from 'next/link';
import { AlertTriangle, Plug, Sparkles, Upload } from 'lucide-react';
import {
  agencyOverviewStats,
  latestInsightAcrossAgency,
  listAnomalies,
  listTopPostsAgency,
} from '@/lib/queries';
import { listClientsForAnalytics, getClientById } from '@/lib/social-bridge';
import { Markdown } from '@/components/markdown';
import { formatNumber, formatPct, snippet } from '@/lib/format';

export default async function OverviewPage() {
  const [stats, latestInsight, topPosts, anomalies, clients] = await Promise.all([
    safe(agencyOverviewStats, {
      active_clients: 0,
      ingested_posts_28d: 0,
      reach_28d: 0,
      avg_engagement_rate_28d: 0,
    }),
    safe(latestInsightAcrossAgency, null),
    safe(() => listTopPostsAgency(28, 10), [] as Awaited<ReturnType<typeof listTopPostsAgency>>),
    safe(listAnomalies, [] as Awaited<ReturnType<typeof listAnomalies>>),
    safe(listClientsForAnalytics, [] as Awaited<ReturnType<typeof listClientsForAnalytics>>),
  ]);

  const insightClient = latestInsight
    ? await safe(() => getClientById(latestInsight.client_id), null)
    : null;

  const isEmpty =
    stats.active_clients === 0 &&
    stats.ingested_posts_28d === 0 &&
    topPosts.length === 0 &&
    anomalies.length === 0;

  return (
    <div className="flex flex-col gap-10">
      <Hero stats={stats} />

      {isEmpty && <EmptyState />}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <InsightPanel
          insight={latestInsight}
          clientName={insightClient?.name ?? null}
          clientSlug={insightClient?.slug ?? null}
        />
        <ClientsList clients={clients} />
      </section>

      {topPosts.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Leaderboard · 28 days</span>
            <span className="text-xs uppercase tracking-eyebrow text-charcoal/55">
              Ranked by saves + 2× shares
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border border-cream-dk/60 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-lt/60">
                <tr className="text-left text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Post</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Reach</th>
                  <th className="px-3 py-2 text-right">Likes</th>
                  <th className="px-3 py-2 text-right">Saves</th>
                  <th className="px-3 py-2 text-right">Shares</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-t border-cream-dk/40 hover:bg-cream-lt/30"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-charcoal/55">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {p.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnail_url}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-md bg-cream font-mono text-[10px] text-charcoal/50">
                            {(p.media_type ?? '?').slice(0, 3)}
                          </div>
                        )}
                        <span className="text-charcoal/85">{snippet(p.caption, 70) || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-charcoal/70">
                      <span className="font-mono text-[12px]">
                        {p.account_handle ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(p.m_reach)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(p.m_likes)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-deep">
                      {formatNumber(p.m_saves)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(p.m_shares)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {anomalies.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Anomalies · reach drop {'>'} 30%</span>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {anomalies.map(a => (
              <div
                key={a.account_id}
                className="rounded-md border border-bad/30 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-bad">
                  <AlertTriangle size={16} />
                  Reach down{' '}
                  {Math.round((1 - (a.ratio ?? 0)) * 100)}%
                </div>
                <div className="mt-2 font-display text-lg font-bold text-green-deep">
                  {a.handle ?? a.platform}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                  {a.platform}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-cream/40 px-2 py-1">
                    7d:{' '}
                    <span className="font-semibold tabular-nums">
                      {formatNumber(a.reach_7d)}
                    </span>
                  </span>
                  <span className="rounded-md bg-cream/40 px-2 py-1">
                    Prev:{' '}
                    <span className="font-semibold tabular-nums">
                      {formatNumber(a.reach_prev_7d)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[overview] query failed:', (err as Error).message);
    return fallback;
  }
}

function Hero({
  stats,
}: {
  stats: {
    active_clients: number;
    ingested_posts_28d: number;
    reach_28d: number;
    avg_engagement_rate_28d: number;
  };
}) {
  return (
    <section className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-10 text-cream shadow-card">
      <span
        aria-hidden
        className="watermark cream pointer-events-none absolute -bottom-6 right-4 text-[160px] leading-none"
      >
        PERF
      </span>
      <span className="eyebrow cream">Performance</span>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-display tracking-display sm:text-5xl">
        Pulse <span className="italic-amber">analytics</span>.
        <span className="mt-1 block font-normal text-cream/75 text-2xl sm:text-3xl">
          {stats.active_clients} client{stats.active_clients === 1 ? '' : 's'} live ·{' '}
          {formatNumber(stats.ingested_posts_28d)} posts ingested ·{' '}
          {formatNumber(stats.reach_28d)} reach last 28d
        </span>
      </h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Clients with data" value={String(stats.active_clients)} />
        <StatTile
          label="Ingested posts · 28d"
          value={formatNumber(stats.ingested_posts_28d)}
        />
        <StatTile label="Reach · 28d" value={formatNumber(stats.reach_28d)} accent="amber" />
        <StatTile
          label="Avg engagement · 28d"
          value={formatPct(stats.avg_engagement_rate_28d)}
          accent="amber"
        />
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-eyebrow text-cream/55">{label}</div>
      <div
        className={`font-display text-2xl font-bold tabular-nums ${
          accent === 'amber' ? 'italic-amber' : 'text-cream-lt'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function InsightPanel({
  insight,
  clientName,
  clientSlug,
}: {
  insight: Awaited<ReturnType<typeof latestInsightAcrossAgency>>;
  clientName: string | null;
  clientSlug: string | null;
}) {
  if (!insight) {
    return (
      <div className="panel p-6">
        <span className="eyebrow">AI insight</span>
        <p className="mt-3 text-sm text-charcoal/65">
          No insights yet. Once data is ingested and the daily insight cron runs, the latest
          narrative across all clients will land here.
        </p>
      </div>
    );
  }
  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">
          AI · latest insight {clientName ? `· ${clientName}` : ''}
        </span>
        <span className="chip-amber">AI</span>
      </div>
      <div className="mt-3">
        <Markdown text={insight.body_md} />
      </div>
      {clientSlug && (
        <Link
          href={`/clients/${clientSlug}`}
          className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
        >
          See full client view →
        </Link>
      )}
    </div>
  );
}

function ClientsList({ clients }: { clients: Awaited<ReturnType<typeof listClientsForAnalytics>> }) {
  return (
    <div className="panel-quiet p-5">
      <span className="eyebrow">Clients</span>
      {clients.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal/60">
          No clients yet — add some on the social side or via{' '}
          <Link href="/integrations" className="underline">
            Integrations
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {clients.slice(0, 12).map(c => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.slug}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-green-deep hover:bg-cream/50"
              >
                <span className="font-display font-bold">{c.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                  {c.slug}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid gap-3 rounded-md border border-dashed border-cream-dk bg-white/60 p-8 text-center">
      <Sparkles className="mx-auto text-amber-deep" size={28} />
      <h2 className="font-display text-2xl font-bold text-green-deep">
        Nothing ingested <span className="italic-amber">yet</span>.
      </h2>
      <p className="mx-auto max-w-md text-sm text-charcoal/65">
        Hook up Instagram + Facebook on Integrations, paste your GA4 property ID, or import a
        CSV export to seed the dashboard.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/integrations" className="btn-primary">
          <Plug size={14} /> Connect a platform
        </Link>
        <Link href="/import" className="btn-secondary">
          <Upload size={14} /> Import CSV
        </Link>
      </div>
    </div>
  );
}
