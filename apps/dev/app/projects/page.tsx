import Link from 'next/link';
import { Plus } from 'lucide-react';
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
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Projects</h1>
          <p className="mt-1 text-sm text-slate-400">
            {projects.length} project{projects.length === 1 ? '' : 's'} (excluding archived).
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <Plus size={14} />
          New project
        </Link>
      </header>

      {projects.length === 0 ? (
        <div className="panel-quiet p-12 text-center">
          <p className="text-sm text-slate-300">No projects yet.</p>
          <Link
            href="/projects/new"
            className="mt-3 inline-block text-sm text-indigo-soft hover:underline"
          >
            Add your first project →
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {PROJECT_STATES.filter(s => s !== 'archived').map(state => {
            const rows = grouped.get(state);
            if (!rows || rows.length === 0) return null;
            return (
              <section key={state}>
                <h2 className="mb-3 text-2xs uppercase tracking-eyebrow text-slate-400">
                  {PROJECT_STATE_LABEL[state]} <span className="text-slate-600">·</span>{' '}
                  <span className="font-mono">{rows.length}</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
