import { notFound } from 'next/navigation';
import { format, startOfMonth } from 'date-fns';
import { getClientBySlug, getCurrentStrategicFrame, getQuota } from '@/lib/queries';
import { StrategyForm, QuotaForm } from './_form';

export const dynamic = 'force-dynamic';

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const frame = await getCurrentStrategicFrame(client.id);
  const monthIso = format(startOfMonth(new Date()), 'yyyy-MM-01');
  const quota = await getQuota(client.id, monthIso);

  return (
    <div className="space-y-12">
      <header className="border-b border-cream-dk/60 pb-7">
        <div className="eyebrow">{client.name}</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          Strategy
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          Quarterly strategic frame and monthly content quotas. Updated by Christian.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
          <header className="border-b border-cream-dk/60 px-7 py-5">
            <div className="eyebrow">Frame</div>
            <h2 className="mt-3 font-display text-2xl font-bold text-green-deep">
              Strategic frame
            </h2>
          </header>
          <div className="p-7">
            <StrategyForm clientSlug={slug} clientId={client.id} initial={frame} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
          <header className="border-b border-cream-dk/60 px-7 py-5">
            <div className="eyebrow">{format(new Date(monthIso), 'LLLL yyyy')}</div>
            <h2 className="mt-3 font-display text-2xl font-bold text-green-deep">
              Quotas
            </h2>
          </header>
          <div className="p-7">
            <QuotaForm
              clientSlug={slug}
              clientId={client.id}
              month={monthIso}
              initial={quota}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
