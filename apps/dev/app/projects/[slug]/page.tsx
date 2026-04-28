import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  GitBranch,
  GitCommit,
  Folder,
  Rocket,
  AlertCircle,
} from 'lucide-react';
import { buildProjectsWithLatest, getProjectBySlug, listTasksForProject } from '@/lib/queries';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import { ProjectStateChip } from '@/components/state-chip';
import { ProjectStateSelector } from './_state-selector';
import { timeAgo } from '@/lib/utils';
import { TASK_STATUSES, TASK_STATUS_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [tasks, withLatest] = await Promise.all([
    listTasksForProject(project.id),
    buildProjectsWithLatest(),
  ]);
  const summary = withLatest.find(p => p.project.id === project.id) ?? null;

  const grouped = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!grouped.has(t.status)) grouped.set(t.status, []);
    grouped.get(t.status)!.push(t);
  }

  return (
    <div className="space-y-8">
      <Link
        href="/projects"
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-soft"
      >
        <ChevronLeft size={14} />
        Projects
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-50">{project.name}</h1>
              <ProjectStateChip state={project.state} />
            </div>
            {project.current_focus && (
              <p className="mt-2 text-base text-slate-300">{project.current_focus}</p>
            )}
          </div>
          <ProjectStateSelector project={project} />
        </div>

        {project.summary && (
          <p className="max-w-3xl text-sm text-slate-400">{project.summary}</p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
          {project.github_repo && (
            <a
              href={`https://github.com/${project.github_repo}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-indigo-soft"
            >
              <GitBranch size={12} />
              <span className="font-mono">{project.github_repo}</span>
            </a>
          )}
          {project.local_path && (
            <span className="flex items-center gap-1.5">
              <Folder size={12} />
              <span className="font-mono">{project.local_path}</span>
            </span>
          )}
          {project.owner && <span>Owner: {project.owner}</span>}
        </div>
      </header>

      {summary && (
        <section className="grid gap-4 md:grid-cols-3">
          <MonitorCard
            icon={<GitCommit size={14} />}
            title="Last commit"
            value={summary.latest_repo?.last_commit_at ? timeAgo(summary.latest_repo.last_commit_at) : '—'}
            detail={summary.latest_repo?.last_commit_message ?? 'No data — run `pnpm gh:poll`'}
          />
          <MonitorCard
            icon={<AlertCircle size={14} />}
            title="Working tree"
            value={
              summary.latest_fs
                ? summary.latest_fs.is_dirty
                  ? 'Dirty'
                  : 'Clean'
                : '—'
            }
            detail={
              summary.latest_fs
                ? `${summary.latest_fs.uncommitted_files ?? 0} uncommitted file(s) on ${summary.latest_fs.current_branch ?? '?'}`
                : 'No data — run `pnpm fs:scan`'
            }
            tone={summary.latest_fs?.is_dirty ? 'warn' : 'ok'}
          />
          <MonitorCard
            icon={<Rocket size={14} />}
            title="Latest deploy"
            value={summary.latest_deployment?.state ?? '—'}
            detail={
              summary.latest_deployment?.deployed_at
                ? timeAgo(summary.latest_deployment.deployed_at)
                : 'No data — POST /api/monitor/deploy'
            }
            tone={
              summary.latest_deployment?.state === 'ERROR'
                ? 'bad'
                : summary.latest_deployment?.state === 'READY'
                  ? 'ok'
                  : 'neutral'
            }
          />
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-50">Tasks</h2>
          <span className="font-mono text-xs text-slate-500">
            {tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length} open ·{' '}
            {tasks.length} total
          </span>
        </div>

        <QuickTaskForm project={project} />

        <div className="space-y-6">
          {TASK_STATUSES.filter(s => s !== 'cancelled').map(s => {
            const rows = grouped.get(s);
            if (!rows || rows.length === 0) return null;
            return (
              <div key={s} className="space-y-2">
                <h3 className="text-2xs uppercase tracking-eyebrow text-slate-400">
                  {TASK_STATUS_LABEL[s]} <span className="text-slate-600">·</span>{' '}
                  <span className="font-mono">{rows.length}</span>
                </h3>
                <div className="space-y-1.5">
                  {rows.map(t => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="panel-quiet p-6 text-center text-sm text-slate-400">
              No tasks yet. Add one above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function MonitorCard({
  icon,
  title,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-active'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'bad'
          ? 'text-bad'
          : 'text-slate-100';
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-2xs uppercase tracking-eyebrow text-slate-400">
        {icon}
        {title}
      </div>
      <div className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 line-clamp-2 text-xs text-slate-400">{detail}</div>
    </div>
  );
}
