import Link from 'next/link';
import { listAgencyRecs } from '@/lib/analytics/queries';
import { listClientsForAnalytics } from '@/lib/analytics/social-bridge';
import { RecommendationCard } from '@/components/analytics/recommendation-card';
import type { RecommendationStatus } from '@/lib/analytics/types';

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const FILTERS: Array<{ key: 'proposed' | 'accepted' | 'dismissed' | 'all'; label: string }> = [
  { key: 'proposed', label: 'Proposed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[recommendations page] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function RecommendationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = (sp.status ?? 'proposed') as RecommendationStatus | 'all';
  const safeStatus: 'proposed' | 'accepted' | 'dismissed' | 'all' =
    (FILTERS.find(f => f.key === status)?.key ?? 'proposed');
  const [recs, clients] = await Promise.all([
    safe(() => listAgencyRecs(safeStatus), [] as Awaited<ReturnType<typeof listAgencyRecs>>),
    safe(listClientsForAnalytics, [] as Awaited<ReturnType<typeof listClientsForAnalytics>>),
  ]);
  const clientNameById = new Map(clients.map(c => [c.id, c]));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-cream-dk/60 pb-4">
        <span className="eyebrow">Recommendations queue</span>
        <h1 className="font-display text-4xl font-bold text-green-deep">
          Advisor <span className="italic-amber">mode</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Concrete actions from the AI advisor across all clients. Accept to draft a post on the
          social side; dismiss with a reason to teach the model.
        </p>
      </header>

      <nav className="flex items-center gap-2">
        {FILTERS.map(f => {
          const active = f.key === safeStatus;
          return (
            <Link
              key={f.key}
              href={`/analytics/recommendations?status=${f.key}`}
              className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-eyebrow ${
                active
                  ? 'border-green-deep bg-green-deep text-cream-lt'
                  : 'border-cream-dk text-charcoal/65 hover:border-green-deep/40 hover:text-green-deep'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {recs.length === 0 ? (
        <p className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
          No recommendations in this state.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recs.map(r => {
            const client = clientNameById.get(r.client_id);
            return (
              <div key={r.id} className="flex flex-col gap-2">
                {client && (
                  <Link
                    href={`/clients/${client.slug}/performance`}
                    className="text-[11px] uppercase tracking-eyebrow text-green-deep hover:text-amber-deep"
                  >
                    {client.name}
                  </Link>
                )}
                <RecommendationCard rec={r} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
