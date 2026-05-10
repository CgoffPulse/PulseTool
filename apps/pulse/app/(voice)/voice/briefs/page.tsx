import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { listClients, listLatestBriefs } from '@/lib/voice/queries';
import { timeAgo } from '@/lib/utils';

export default async function BriefsPage() {
  const [briefs, clients] = await Promise.all([
    listLatestBriefs(),
    listClients(),
  ]);

  const briefByClient = new Map(briefs.map(b => [b.client_id ?? '__global__', b]));
  const clientsWithoutBrief = clients.filter(
    c => !briefByClient.has(c.id)
  );
  const globalBrief = briefByClient.get('__global__');

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Brand briefs</span>
        <h1 className="font-display text-4xl font-bold tracking-display text-green-deep">
          One <span className="italic-amber">voice</span> per client.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Versioned voice docs that ground every prompt. Saving a brief writes a
          new version row — we never overwrite history. The latest version is
          what the gateway injects automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/voice/briefs/global" className="btn-secondary">
            <Plus size={14} /> Edit global voice
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <span className="eyebrow">With a brief</span>
        {briefs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {globalBrief && (
              <BriefCard
                href="/voice/briefs/global"
                title="Global voice"
                version={globalBrief.version}
                bodyPreview={globalBrief.body_md}
                updatedAt={globalBrief.updated_at}
              />
            )}
            {briefs
              .filter(b => b.client_id)
              .map(b => (
                <BriefCard
                  key={b.id}
                  href={`/voice/briefs/${b.client_id}`}
                  title={b.client_name ?? 'Unknown client'}
                  version={b.version}
                  bodyPreview={b.body_md}
                  updatedAt={b.updated_at}
                />
              ))}
          </div>
        )}
      </section>

      {clientsWithoutBrief.length > 0 && (
        <section className="flex flex-col gap-4">
          <span className="eyebrow">No brief yet</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientsWithoutBrief.map(c => (
              <Link
                key={c.id}
                href={`/voice/briefs/${c.id}`}
                className="group flex items-center justify-between gap-2 rounded-md border border-dashed border-cream-dk bg-white/50 p-4 shadow-sm transition-all hover:border-amber-mid/60 hover:bg-white"
              >
                <div>
                  <div className="font-display text-base font-bold text-green-deep">
                    {c.name}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                    /{c.slug}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-mid px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal group-hover:bg-amber-deep group-hover:text-cream-lt">
                  <Plus size={12} /> Brief
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BriefCard({
  href,
  title,
  version,
  bodyPreview,
  updatedAt,
}: {
  href: string;
  title: string;
  version: number;
  bodyPreview: string;
  updatedAt: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm transition-all duration-fast hover:-translate-y-0.5 hover:border-amber-mid/60 hover:shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-lg font-bold text-green-deep">
          {title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
          v{version}
        </span>
      </div>
      <p className="line-clamp-3 text-xs text-charcoal/65">
        {bodyPreview.trim() || 'No body yet — open to edit.'}
      </p>
      <div className="mt-auto text-[10px] uppercase tracking-eyebrow text-charcoal/45">
        Updated {timeAgo(updatedAt)}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/60 p-12 text-center">
      <Sparkles size={28} className="mb-3 text-amber-deep" />
      <h2 className="font-display text-2xl font-bold text-green-deep">
        No briefs <span className="italic-amber">yet</span>.
      </h2>
      <p className="mt-2 max-w-md text-sm text-charcoal/65">
        Pick a client below to write the first brand brief, or write the global
        voice that applies to anything without a client-specific brief.
      </p>
    </div>
  );
}
