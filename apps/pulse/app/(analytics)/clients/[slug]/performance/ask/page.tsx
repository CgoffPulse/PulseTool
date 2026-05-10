import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientByPlatformSlug } from '@/lib/analytics/social-bridge';
import { listSavedChartsForClient } from '@/lib/analytics/queries';
import { AskForm } from './_ask-form';
import { ChartRenderer } from '@/components/analytics/chart-renderer';
import { timeAgo } from '@/lib/analytics/format';

interface Props {
  params: Promise<{ slug: string }>;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[ask page] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function AskPage({ params }: Props) {
  const { slug } = await params;
  const client = await getClientByPlatformSlug(slug);
  if (!client) return notFound();

  const saved = await safe(
    () => listSavedChartsForClient(client.id),
    [] as Awaited<ReturnType<typeof listSavedChartsForClient>>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 border-b border-cream-dk/60 pb-4">
        <div>
          <span className="eyebrow">Auto-visualize · {client.name}</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-green-deep">
            Ask the <span className="italic-amber">data</span>.
          </h1>
          <p className="text-sm text-charcoal/65">
            Type a question — Pulse picks the chart shape and shows it here.
          </p>
        </div>
        <Link
          href={`/clients/${slug}/performance`}
          className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
        >
          ← Back to client
        </Link>
      </header>

      <section className="panel p-6">
        <AskForm clientId={client.id} />
      </section>

      {saved.length > 0 && (
        <section className="flex flex-col gap-4">
          <span className="eyebrow">Pinned charts</span>
          <div className="grid gap-4 lg:grid-cols-2">
            {saved.map(s => (
              <div key={s.id} className="flex flex-col gap-3">
                <p className="text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                  {s.prompt} · pinned {timeAgo(s.created_at)}
                </p>
                <ChartRenderer spec={s.chart_spec_json} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
