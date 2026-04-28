import Link from 'next/link';
import { Plus, Telescope } from 'lucide-react';
import { buildProjectsWithLatest } from '@/lib/queries';
import { ProjectCard } from '@/components/project-card';
import { PROJECT_STATES, PROJECT_STATE_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await buildProjectsWithLatest();

  const grouped = new Map<string, typeof projects>();
  for (const p of projects) {
    if (!grouped.has(p.project.state)) grouped.set(p.project.state, []);
    grouped.get(p.project.state)!.push(p);
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">
            <span>Projects</span>
          </span>
          <h1 className="mt-3 font-display text-4xl font-black tracking-display text-green-deep sm:text-5xl">
            Everything we&rsquo;re building.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-charcoal/65">
            {projects.length} project{projects.length === 1 ? '' : 's'}{' '}
            (excluding archived). Promote, pause, ship, or rest them — the
            dashboard reads state into the rest of the hub.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/projects/discover" className="btn-secondary">
            <Telescope size={14} />
            Discover
          </Link>
          <Link href="/projects/new" className="btn-primary">
            <Plus size={14} />
            New project
          </Link>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="grain rounded-xl border border-cream/10 bg-green-deep p-12 text-center text-cream">
          <p className="font-display text-2xl font-bold">
            No projects yet.
            <br />
            <span className="italic-amber">Pull them in from disk.</span>
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-cream/70">
            Either add one manually, or let the discover pass walk{' '}
            <code className="rounded bg-cream/10 px-1 font-mono text-[11px]">
              DEV_PROJECTS_ROOT
            </code>
            .
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/projects/discover" className="btn-primary">
              <Telescope size={14} />
              Discover
            </Link>
            <Link href="/projects/new" className="btn-on-dark">
              <Plus size={14} />
              Add manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {PROJECT_STATES.filter(s => s !== 'archived').map(state => {
            const rows = grouped.get(state);
            if (!rows || rows.length === 0) return null;
            return (
              <section key={state}>
                <h2 className="mb-4 flex items-baseline gap-3 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/55">
                  <span>{PROJECT_STATE_LABEL[state]}</span>
                  <span className="font-mono tabular-nums text-charcoal/35">
                    {rows.length}
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map(r => (
                    <ProjectCard key={r.project.id} row={r} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
