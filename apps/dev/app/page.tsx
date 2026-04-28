import Link from 'next/link';
import { AlertCircle, Plus, Rocket } from 'lucide-react';
import { buildProjectsWithLatest, buildTodayTasks, listProjects } from '@/lib/queries';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import { ProjectStateChip } from '@/components/state-chip';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const [today, projectsWithLatest, allProjects] = await Promise.all([
    buildTodayTasks(),
    buildProjectsWithLatest(),
    listProjects(),
  ]);

  const dirty = projectsWithLatest.filter(p => p.latest_fs?.is_dirty);
  const failingDeploys = projectsWithLatest.filter(
    p => p.latest_deployment?.state === 'ERROR'
  );
  const stale = projectsWithLatest.filter(p => {
    const at = p.latest_repo?.last_commit_at;
    if (!at || p.project.state !== 'active') return false;
    return Date.now() - new Date(at).getTime() > 14 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-50">Today</h1>
          <p className="mt-1 text-sm text-slate-400">
            What&apos;s in flight, what&apos;s up next, and what&apos;s about to slip.
          </p>
        </header>

        <QuickTaskForm projects={allProjects} />

        {today.length === 0 ? (
          <div className="panel-quiet p-8 text-center text-sm text-slate-400">
            Inbox zero across all projects. Nice.{' '}
            <Link href="/projects/new" className="text-indigo-soft hover:underline">
              Add a project
            </Link>{' '}
            or queue work above.
          </div>
        ) : (
          <div className="space-y-2">
            {today.map(({ task, project }) => (
              <TaskRow key={task.id} task={task} project={project} showProject />
            ))}
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <Section title="Active projects" count={projectsWithLatest.filter(p => p.project.state === 'active').length}>
          <Link
            href="/projects/new"
            className="btn-ghost mb-3 w-full justify-center text-xs"
          >
            <Plus size={12} />
            New project
          </Link>
          <div className="space-y-1.5">
            {projectsWithLatest
              .filter(p => p.project.state === 'active')
              .slice(0, 8)
              .map(p => (
                <Link
                  key={p.project.id}
                  href={`/projects/${p.project.slug}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-slate-500/10"
                >
                  <span className="truncate text-slate-100">{p.project.name}</span>
                  <span className="text-2xs text-slate-400">
                    {p.open_task_count > 0 ? `${p.open_task_count} open` : '—'}
                  </span>
                </Link>
              ))}
            {projectsWithLatest.filter(p => p.project.state === 'active').length === 0 && (
              <p className="px-2 text-xs text-slate-500">No active projects.</p>
            )}
          </div>
        </Section>

        {(dirty.length > 0 || failingDeploys.length > 0 || stale.length > 0) && (
          <Section title="Attention">
            <div className="space-y-2">
              {dirty.slice(0, 5).map(p => (
                <AttentionRow
                  key={`d-${p.project.id}`}
                  project={p.project.slug}
                  name={p.project.name}
                  detail={`${p.latest_fs?.uncommitted_files ?? '?'} uncommitted file(s)`}
                  icon={<AlertCircle size={12} className="text-warn" />}
                />
              ))}
              {failingDeploys.slice(0, 5).map(p => (
                <AttentionRow
                  key={`f-${p.project.id}`}
                  project={p.project.slug}
                  name={p.project.name}
                  detail="Deploy failing"
                  icon={<Rocket size={12} className="text-bad" />}
                />
              ))}
              {stale.slice(0, 5).map(p => (
                <AttentionRow
                  key={`s-${p.project.id}`}
                  project={p.project.slug}
                  name={p.project.name}
                  detail={`No commits ${timeAgo(p.latest_repo?.last_commit_at)}`}
                  icon={<AlertCircle size={12} className="text-archived" />}
                />
              ))}
            </div>
          </Section>
        )}

        <Section title="Recent">
          <div className="space-y-2">
            {projectsWithLatest.slice(0, 5).map(p => (
              <div key={p.project.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/projects/${p.project.slug}`}
                  className="truncate text-slate-200 hover:text-indigo-soft"
                >
                  {p.project.name}
                </Link>
                <ProjectStateChip state={p.project.state} />
              </div>
            ))}
            {projectsWithLatest.length === 0 && (
              <p className="text-xs text-slate-500">No projects yet.</p>
            )}
          </div>
        </Section>
      </aside>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xs uppercase tracking-eyebrow text-slate-400">{title}</h2>
        {count !== undefined && (
          <span className="font-mono text-2xs text-slate-500">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function AttentionRow({
  project,
  name,
  detail,
  icon,
}: {
  project: string;
  name: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={`/projects/${project}`}
      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-500/10"
    >
      {icon}
      <span className="flex-1 truncate text-slate-100">{name}</span>
      <span className="text-2xs text-slate-400">{detail}</span>
    </Link>
  );
}
