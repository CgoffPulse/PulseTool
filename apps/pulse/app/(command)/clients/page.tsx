import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ClientTierChip } from '@/components/state-chip';
import { listClients } from '@/lib/command/queries';

export const dynamic = 'force-dynamic';

export default async function ClientsIndexPage() {
  const clients = await listClients();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Clients
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
          The retainer book
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          Every active client. Click through for tier, service lines, open projects, and content
          snapshot.
        </p>
      </header>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
          <h3 className="font-display text-lg font-semibold text-stone-900">No clients yet</h3>
          <p className="max-w-md text-[14px] leading-[1.55] text-stone-600">
            Promote a CRM lead to spin up the first client.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.map(c => (
            <Link
              key={c.id}
              href={`/clients/${c.slug}`}
              className="group flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="font-display text-lg font-semibold tracking-tight text-stone-900">
                    {c.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {c.tier && <ClientTierChip tier={c.tier} />}
                    {c.service_lines && c.service_lines.length > 0 && (
                      <span className="text-[11px] text-stone-500">
                        {c.service_lines.slice(0, 3).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ArrowUpRight
                size={16}
                className="shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
