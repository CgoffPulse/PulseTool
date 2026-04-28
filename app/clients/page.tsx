import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowUpRight } from 'lucide-react';
import { listClients } from '@/lib/queries';
import { fmtMonth } from '@/lib/utils';
import { CreateClientForm } from '../_components/create-client-form';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let connError: string | null = null;
  try {
    clients = await listClients();
  } catch (err) {
    connError = err instanceof Error ? err.message : String(err);
  }

  const thisMonth = format(new Date(), 'yyyy-MM-01');

  return (
    <div className="space-y-12">
      <header className="border-b border-cream-dk/60 pb-7">
        <div className="eyebrow">Roster</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          Clients
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          Each client is its own monthly planning workspace.
        </p>
      </header>

      {connError ? (
        <div className="rounded-lg border border-amber-deep/30 bg-amber-light/30 px-5 py-4 text-sm text-charcoal">
          <div className="font-semibold">Can't connect to Supabase.</div>
          <div className="mt-1 font-mono text-xs">{connError}</div>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {clients.map(c => {
          const initials = c.name
            .split(/\s+/)
            .map(w => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          return (
            <Link
              key={c.id}
              href={`/clients/${c.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-cream-dk/60 bg-white p-6 shadow-card transition-all duration-base ease-pulse hover:-translate-y-1 hover:border-amber-mid/40 hover:shadow-lift"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ backgroundColor: c.color }}
              />
              <div className="flex items-start justify-between">
                <span
                  className="grid h-12 w-12 place-items-center rounded-md text-cream-lt"
                  style={{ backgroundColor: c.color }}
                >
                  <span className="font-display text-base font-bold">{initials}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/40">
                  /{c.slug}
                </span>
              </div>
              <h3 className="mt-7 font-display text-2xl font-bold leading-tight text-green-deep">
                {c.name}
              </h3>
              <p className="mt-2 text-sm text-charcoal/60">
                {fmtMonth(thisMonth)} → upcoming
              </p>
              <div className="mt-7 flex items-center justify-between border-t border-cream-dk/60 pt-4 text-xs uppercase tracking-eyebrow text-charcoal/55">
                <span>Open workspace</span>
                <ArrowUpRight
                  size={16}
                  className="text-amber-deep transition-transform duration-fast group-hover:translate-x-1 group-hover:-translate-y-0.5"
                />
              </div>
            </Link>
          );
        })}

        <div className="flex flex-col rounded-2xl border border-dashed border-green-deep/25 bg-cream-lt p-6">
          <div className="eyebrow green">Add to roster</div>
          <h3 className="mt-3 font-display text-xl font-bold text-green-deep">
            New client workspace
          </h3>
          <p className="mt-2 text-sm leading-body text-charcoal/60">
            Slug becomes the URL handle. Lowercase letters, numbers, underscores only.
          </p>
          <div className="mt-5">
            <CreateClientForm />
          </div>
        </div>
      </section>
    </div>
  );
}
