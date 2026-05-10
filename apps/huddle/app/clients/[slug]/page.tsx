import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClientTierChip } from '@/components/state-chip';
import { ProjectCard } from '@/components/project-card';
import {
  getClient,
  getClientSnapshot,
  listProjects,
} from '@/lib/command-queries';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClient(slug);
  if (!client) notFound();

  const [projects, snap] = await Promise.all([
    listProjects({ client_id: client.id }),
    getClientSnapshot(client.id),
  ]);

  const briefAgeText = snap.brand_brief?.updated_at
    ? `v${snap.brand_brief.version ?? '?'} · updated ${timeAgo(snap.brand_brief.updated_at)}`
    : 'No brief on file';

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/clients"
          className="self-start text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          ← All clients
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {client.tier && <ClientTierChip tier={client.tier} />}
              {(client.service_lines ?? []).slice(0, 4).map(sl => (
                <span
                  key={sl}
                  className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-700"
                >
                  {sl}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: client.color }}
                aria-hidden
              />
              <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-900">
                {client.name}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Posts this month" value={String(snap.posts_this_month)} />
        <Stat label="Shoots this month" value={String(snap.shoots_this_month)} />
        <Stat label="Open projects" value={String(projects.length)} />
        <Stat
          label="Brand brief"
          value={snap.brand_brief?.version ? `v${snap.brand_brief.version}` : '—'}
          hint={briefAgeText}
        />
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Retainer health
        </div>
        <p className="mt-2 text-[14px] leading-[1.55] text-stone-600">
          Connect QuickBooks to surface invoice status, payment history, and renewal cadence here.
          Pulse never writes to QB — read-only by design.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
          Projects
        </h2>
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-12 text-center text-[14px] text-stone-600">
            No projects on file for this client. Spin one up from the projects page.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => (
              <ProjectCard key={p.id} row={p} />
            ))}
          </div>
        )}
      </section>

      {snap.recent_insights.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
            Recent insights
          </h2>
          <div className="flex flex-col gap-2">
            {snap.recent_insights.map(i => (
              <article
                key={i.id}
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                  {timeAgo(i.generated_at)}
                </div>
                <p className="mt-2 line-clamp-4 text-[14px] leading-[1.55] text-stone-700">
                  {i.body_md.replace(/[#*`>]/g, '').trim()}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums text-stone-900">
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-stone-500">{hint}</div>}
    </div>
  );
}
