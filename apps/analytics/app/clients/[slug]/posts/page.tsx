import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientByPlatformSlug, listRecentPlannedPosts } from '@/lib/social-bridge';
import { listPostsForClient } from '@/lib/queries';
import { q } from '@/lib/db';
import { formatNumber, shortDate, snippet } from '@/lib/format';

interface Props {
  params: Promise<{ slug: string }>;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[posts page] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function PostMatrixPage({ params }: Props) {
  const { slug } = await params;
  const client = await getClientByPlatformSlug(slug);
  if (!client) return notFound();

  const [planned, ingested, matchRows] = await Promise.all([
    safe(() => listRecentPlannedPosts(client.id, 60), [] as Awaited<ReturnType<typeof listRecentPlannedPosts>>),
    safe(() => listPostsForClient(client.id, 60), [] as Awaited<ReturnType<typeof listPostsForClient>>),
    safe(
      () =>
        q<{ public_post_id: string; posts_external_id: string }>(
          `select pm.public_post_id, pm.posts_external_id
             from analytics.post_match pm
             join analytics.posts_external pe on pe.id = pm.posts_external_id
             join analytics.platform_accounts a on a.id = pe.account_id
            where a.client_id = $1`,
          [client.id]
        ),
      [] as Array<{ public_post_id: string; posts_external_id: string }>
    ),
  ]);

  const matchByPlanned = new Map<string, string>();
  for (const m of matchRows) matchByPlanned.set(m.public_post_id, m.posts_external_id);
  const externalById = new Map(ingested.map(p => [p.id, p]));
  const matchedExternalIds = new Set(matchByPlanned.values());

  const unmatched = ingested.filter(p => !matchedExternalIds.has(p.id));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 border-b border-cream-dk/60 pb-4">
        <div>
          <span className="eyebrow">Post matrix</span>
          <h1 className="mt-2 font-display text-3xl font-bold text-green-deep">
            {client.name} <span className="italic-amber">posts</span>
          </h1>
          <p className="text-sm text-charcoal/65">
            Planned posts joined to ingested platform data via{' '}
            <span className="font-mono text-[12px]">analytics.post_match</span>.
          </p>
        </div>
        <Link
          href={`/clients/${slug}`}
          className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
        >
          ← Back to client
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <span className="eyebrow">Planned · last 60 days</span>
        {planned.length === 0 ? (
          <p className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
            No planned posts in the social schema for this client. Plan some on the social tool
            to see this matrix populated.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-cream-dk/60 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-lt/60">
                <tr className="text-left text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2 text-right">Reach</th>
                  <th className="px-3 py-2 text-right">Saves</th>
                  <th className="px-3 py-2 text-right">Shares</th>
                </tr>
              </thead>
              <tbody>
                {planned.map(p => {
                  const exId = matchByPlanned.get(p.id);
                  const ext = exId ? externalById.get(exId) ?? null : null;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-cream-dk/40 ${
                        ext ? '' : 'bg-amber/5'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{shortDate(p.post_date)}</td>
                      <td className="px-3 py-2">
                        <span className="chip-cream">{p.content_type}</span>
                      </td>
                      <td className="px-3 py-2 text-charcoal/85">
                        {snippet(p.description, 80) || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {ext ? (
                          <span className="chip-green">Matched</span>
                        ) : (
                          <span className="chip-amber">Unmatched</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(ext?.m_reach ?? null)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(ext?.m_saves ?? null)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(ext?.m_shares ?? null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {unmatched.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Ingested but unmatched · last 60 days</span>
          <p className="text-xs text-charcoal/55">
            Posts that were ingested from the platform but don't have a matching planned post in
            the social tool. Consider matching them or recording them as ad-hoc content.
          </p>
          <div className="overflow-x-auto rounded-md border border-amber-mid/40 bg-amber/5 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-eyebrow text-charcoal/60">
                  <th className="px-3 py-2">Posted</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Caption</th>
                  <th className="px-3 py-2 text-right">Reach</th>
                  <th className="px-3 py-2 text-right">Saves</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.slice(0, 50).map(p => (
                  <tr key={p.id} className="border-t border-amber-mid/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      {shortDate(p.posted_at)}
                    </td>
                    <td className="px-3 py-2 text-charcoal/65">{p.account_handle ?? '—'}</td>
                    <td className="px-3 py-2 text-charcoal/85">
                      {snippet(p.caption, 80) || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(p.m_reach)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(p.m_saves)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
