import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ChevronLeft,
  ExternalLink,
  Folder,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Rocket,
  Terminal,
} from 'lucide-react';
import {
  buildProjectsWithLatest,
  getProjectBySlug,
  listCommitsForProject,
  listDeploysForProject,
  listFsSnapshotsForProject,
  listTasksForProject,
} from '@/lib/queries';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import { ProjectStateChip } from '@/components/state-chip';
import { ProjectStateSelector } from './_state-selector';
import { timeAgo } from '@/lib/utils';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Deployment,
  type FsSnapshot,
  type RepoActivity,
  type Task,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [tasks, withLatest, commits, deploys, fsHistory] = await Promise.all([
    listTasksForProject(project.id),
    buildProjectsWithLatest(),
    listCommitsForProject(project.id, 10),
    listDeploysForProject(project.id, 6),
    listFsSnapshotsForProject(project.id, 6),
  ]);
  const summary = withLatest.find(p => p.project.id === project.id) ?? null;

  const grouped = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!grouped.has(t.status)) grouped.set(t.status, []);
    grouped.get(t.status)!.push(t);
  }

  const finderHref = project.local_path
    ? `file://${encodeURI(project.local_path)}`
    : null;
  const cursorHref = project.local_path
    ? `cursor://file/${encodeURI(project.local_path)}`
    : null;
  const githubHref = project.github_repo
    ? `https://github.com/${project.github_repo}`
    : null;
  const vercelHref = project.vercel_project_id
    ? `https://vercel.com/dashboard?slug=&project=${project.vercel_project_id}`
    : null;

  return (
    <div className="space-y-10">
      <Link
        href="/projects"
        className="flex items-center gap-1 text-xs text-charcoal/60 hover:text-amber-deep"
      >
        <ChevronLeft size={14} />
        Projects
      </Link>

      {/* ─────────────── HERO ─────────────── */}
      <header className="grain relative overflow-hidden rounded-xl border border-cream/10 bg-green-deep px-8 py-10 text-cream shadow-card">
        <span
          aria-hidden
          className="watermark cream absolute -right-4 -bottom-12 text-[200px]"
        >
          {project.name.slice(0, 3).toUpperCase()}
        </span>
        <div className="relative space-y-3">
          <span className="eyebrow cream">
            <span>Project</span>
          </span>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="font-display text-4xl font-black leading-display tracking-display sm:text-5xl">
              {project.name}
              {project.current_focus && (
                <span className="block text-2xl font-bold text-cream/65 sm:text-3xl">
                  Building <span className="italic-amber">{project.current_focus}</span>.
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3">
              <ProjectStateChip state={project.state} />
              <ProjectStateSelector project={project} />
            </div>
          </div>

          {project.summary && (
            <p className="max-w-3xl pt-2 text-base text-cream/75">{project.summary}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-4">
            {githubHref && (
              <QuickAction href={githubHref} icon={<GitBranch size={14} />}>
                {project.github_repo}
              </QuickAction>
            )}
            {finderHref && (
              <QuickAction href={finderHref} icon={<Folder size={14} />}>
                Open in Finder
              </QuickAction>
            )}
            {cursorHref && (
              <QuickAction href={cursorHref} icon={<Terminal size={14} />}>
                Open in Cursor
              </QuickAction>
            )}
            {vercelHref && (
              <QuickAction href={vercelHref} icon={<Rocket size={14} />}>
                Vercel dashboard
              </QuickAction>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────── MONITOR TILES ─────────────── */}
      {summary && (
        <section className="grid gap-4 md:grid-cols-3">
          <MonitorCard
            icon={<GitCommit size={14} />}
            title="Last commit"
            value={
              summary.latest_repo?.last_commit_at
                ? timeAgo(summary.latest_repo.last_commit_at)
                : '—'
            }
            detail={
              summary.latest_repo?.last_commit_message ??
              'No data — run `pnpm gh:poll` or POST /api/cron/refresh-monitors'
            }
            extra={
              summary.latest_repo?.open_pr_count != null ? (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-charcoal/55">
                  <GitPullRequest size={11} />
                  <span className="font-mono">
                    {summary.latest_repo.open_pr_count}
                  </span>{' '}
                  open PR{summary.latest_repo.open_pr_count === 1 ? '' : 's'} ·{' '}
                  <span className="font-mono">
                    {summary.latest_repo.open_issue_count ?? 0}
                  </span>{' '}
                  issue
                  {summary.latest_repo.open_issue_count === 1 ? '' : 's'}
                </span>
              ) : null
            }
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
                : 'No data — run `pnpm fs:scan` locally'
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
                : 'No data — POST /api/cron/refresh-monitors'
            }
            tone={
              summary.latest_deployment?.state === 'ERROR'
                ? 'bad'
                : summary.latest_deployment?.state === 'READY'
                  ? 'ok'
                  : 'neutral'
            }
            extra={
              summary.latest_deployment?.url ? (
                <a
                  href={summary.latest_deployment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-green-deep hover:text-amber-deep"
                >
                  <ExternalLink size={11} />
                  Open
                </a>
              ) : null
            }
          />
        </section>
      )}

      {/* ─────────────── HISTORY ─────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        <HistoryPanel title="Commits" eyebrow="On the wire">
          {commits.length === 0 ? (
            <Empty>No commit history yet.</Empty>
          ) : (
            <ul className="divide-y divide-cream-dk/40">
              {commits.map(c => (
                <CommitItem key={c.id} c={c} />
              ))}
            </ul>
          )}
        </HistoryPanel>
        <HistoryPanel title="Deploys" eyebrow="Shipped">
          {deploys.length === 0 ? (
            <Empty>No deployment events yet.</Empty>
          ) : (
            <ul className="divide-y divide-cream-dk/40">
              {deploys.map(d => (
                <DeployItem key={d.id} d={d} />
              ))}
            </ul>
          )}
        </HistoryPanel>
        <HistoryPanel title="Filesystem" eyebrow="On disk">
          {fsHistory.length === 0 ? (
            <Empty>No filesystem snapshots yet.</Empty>
          ) : (
            <ul className="divide-y divide-cream-dk/40">
              {fsHistory.map(f => (
                <FsItem key={f.id} f={f} />
              ))}
            </ul>
          )}
        </HistoryPanel>
      </section>

      {/* ─────────────── TASKS ─────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="eyebrow green">
              <span>Tasks</span>
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-display text-green-deep sm:text-3xl">
              The work, <span className="italic-amber">in pieces.</span>
            </h2>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-charcoal/50">
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
                <h3 className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/55">
                  {TASK_STATUS_LABEL[s]}
                  <span className="ml-2 font-mono text-charcoal/35">·</span>
                  <span className="ml-1.5 font-mono tabular-nums">{rows.length}</span>
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
            <p className="panel-quiet p-6 text-center text-sm text-charcoal/55">
              No tasks yet. Add one above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function QuickAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
      className="inline-flex items-center gap-2 rounded-md border border-cream/20 bg-cream/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:border-amber-mid/60 hover:bg-amber-mid/15 hover:text-amber-light"
    >
      {icon}
      <span className="font-mono normal-case tracking-normal text-cream/85">{children}</span>
    </a>
  );
}

function MonitorCard({
  icon,
  title,
  value,
  detail,
  tone = 'neutral',
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  extra?: React.ReactNode;
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-green-mid'
      : tone === 'warn'
        ? 'text-amber-deep'
        : tone === 'bad'
          ? 'text-bad'
          : 'text-green-deep';
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/55">
        {icon}
        {title}
      </div>
      <div className={`mt-2 font-display text-2xl font-bold tracking-display ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-charcoal/65">{detail}</div>
      {extra}
    </div>
  );
}

function HistoryPanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-cream-dk/40 px-5 py-4">
        <span className="eyebrow green">
          <span>{eyebrow}</span>
        </span>
        <h3 className="font-display text-base font-bold text-green-deep">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-6 text-sm text-charcoal/55">{children}</div>;
}

function CommitItem({ c }: { c: RepoActivity }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3 text-sm">
      <GitCommit size={14} className="mt-0.5 shrink-0 text-green-mid" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-charcoal">
          {c.last_commit_message ?? '—'}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-charcoal/45">
          <span className="font-mono">
            {c.last_commit_sha ? c.last_commit_sha.slice(0, 7) : '—'}
          </span>
          <span>·</span>
          <span>{c.default_branch ?? 'main'}</span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[10px] uppercase text-charcoal/45">
        {timeAgo(c.last_commit_at)}
      </span>
    </li>
  );
}

function DeployItem({ d }: { d: Deployment }) {
  const stateClass =
    d.state === 'READY'
      ? 'text-green-mid'
      : d.state === 'ERROR'
        ? 'text-bad'
        : 'text-amber-deep';
  return (
    <li className="flex items-start gap-3 px-5 py-3 text-sm">
      <Rocket size={14} className={`mt-0.5 shrink-0 ${stateClass}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold uppercase tracking-eyebrow text-charcoal/85">
          {d.state ?? 'PENDING'}
        </div>
        {d.url && (
          <a
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-[11px] text-green-deep hover:text-amber-deep"
          >
            {d.url}
          </a>
        )}
      </div>
      <span className="shrink-0 font-mono text-[10px] uppercase text-charcoal/45">
        {timeAgo(d.deployed_at ?? d.observed_at)}
      </span>
    </li>
  );
}

function FsItem({ f }: { f: FsSnapshot }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3 text-sm">
      <GitBranch size={14} className="mt-0.5 shrink-0 text-charcoal/55" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-charcoal">
          {f.is_dirty ? (
            <span className="font-semibold text-amber-deep">
              dirty ({f.uncommitted_files ?? '?'})
            </span>
          ) : (
            <span className="font-semibold text-green-mid">clean</span>
          )}
          <span className="ml-2 font-mono text-charcoal/55">
            {f.current_branch ?? '—'}
          </span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[10px] uppercase text-charcoal/45">
        {timeAgo(f.observed_at)}
      </span>
    </li>
  );
}
