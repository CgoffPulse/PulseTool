import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  GitBranch,
  GitCommit,
  Inbox,
  Plus,
  Rocket,
  Sparkles,
  Telescope,
} from 'lucide-react';
import {
  buildHubStats,
  buildProjectsWithLatest,
  buildTodayTasks,
  listProjects,
  listRecentCommits,
  listRecentDeploys,
} from '@/lib/queries';
import { readSocialPulse } from '@/lib/social-bridge';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import { ProjectStateChip } from '@/components/state-chip';
import { ProjectCard } from '@/components/project-card';
import { RefreshButton } from '@/components/refresh-button';
import { SisterToolCard } from '@/components/sister-tool-card';
import { timeAgo } from '@/lib/utils';
import type { HubStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HubHome() {
  const [
    stats,
    projectsWithLatest,
    today,
    allProjects,
    commits,
    deploys,
    socialPulse,
  ] = await Promise.all([
    buildHubStats(),
    buildProjectsWithLatest(),
    buildTodayTasks(),
    listProjects(),
    listRecentCommits(10),
    listRecentDeploys(8),
    readSocialPulse(),
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
  const activeProjects = projectsWithLatest.filter(
    p => p.project.state === 'active'
  );
  const inFlight = today.filter(t => t.task.status === 'in_progress');
  const upNext = today.filter(t => t.task.status === 'next');
  const urgent = today.filter(
    t =>
      (t.task.priority === 'p0' || t.task.priority === 'p1') &&
      t.task.status !== 'in_progress' &&
      t.task.status !== 'next'
  );

  const noData =
    commits.length === 0 && deploys.length === 0 && allProjects.length === 0;

  return (
    <div className="space-y-12">
      {/* ─────────────── HERO ─────────────── */}
      <section className="grain relative overflow-hidden rounded-xl border border-cream/10 bg-green-deep px-6 py-8 text-cream shadow-card sm:px-8 sm:py-10">
        <span
          aria-hidden
          className="watermark cream absolute -right-6 -bottom-12 text-[120px] sm:text-[180px]"
        >
          DEV
        </span>
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="eyebrow cream">
              <span>Pulse Dev &middot; Shop floor</span>
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-display tracking-display sm:text-5xl">
              Everything we&rsquo;re building.
              <br />
              <span className="italic-amber font-display">In one place.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-cream/75">
              The dev hub watches every project across GitHub, your laptop, and
              Vercel — then tells you what to look at next. No more scrolling
              the dock to remember what&rsquo;s in flight.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/projects/new" className="btn-primary">
              <Plus size={14} />
              New project
            </Link>
            <Link href="/projects/discover" className="btn-on-dark">
              <Telescope size={14} />
              Discover
            </Link>
            <RefreshButton tone="dark" />
          </div>
        </div>

        <StatsStrip stats={stats} />
      </section>

      {/* ─────────────── ATTENTION ─────────────── */}
      {(urgent.length > 0 ||
        dirty.length > 0 ||
        failingDeploys.length > 0 ||
        stale.length > 0) && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Attention"
            title={
              <>
                Worth a look <span className="italic-amber">right now.</span>
              </>
            }
            count={
              urgent.length + dirty.length + failingDeploys.length + stale.length
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {failingDeploys.length > 0 && (
              <AttentionTile
                tone="bad"
                icon={<Rocket size={16} />}
                title="Deploy failing"
                detail={`${failingDeploys.length} project${failingDeploys.length === 1 ? '' : 's'}`}
                rows={failingDeploys.slice(0, 4).map(p => ({
                  name: p.project.name,
                  slug: p.project.slug,
                  hint: 'ERROR',
                }))}
              />
            )}
            {urgent.length > 0 && (
              <AttentionTile
                tone="amber"
                icon={<Flame size={16} />}
                title="Urgent tasks"
                detail={`${urgent.length} item${urgent.length === 1 ? '' : 's'} P0/P1`}
                rows={urgent.slice(0, 4).map(t => ({
                  name: t.task.title,
                  slug: t.project?.slug ?? '',
                  hint: t.task.priority.toUpperCase(),
                }))}
              />
            )}
            {dirty.length > 0 && (
              <AttentionTile
                tone="amber"
                icon={<AlertCircle size={16} />}
                title="Dirty working trees"
                detail={`${dirty.length} repo${dirty.length === 1 ? '' : 's'} unsaved`}
                rows={dirty.slice(0, 4).map(p => ({
                  name: p.project.name,
                  slug: p.project.slug,
                  hint: `${p.latest_fs?.uncommitted_files ?? '?'} files`,
                }))}
              />
            )}
            {stale.length > 0 && (
              <AttentionTile
                tone="quiet"
                icon={<GitCommit size={16} />}
                title="Going quiet"
                detail={`No commits in 14d+`}
                rows={stale.slice(0, 4).map(p => ({
                  name: p.project.name,
                  slug: p.project.slug,
                  hint: timeAgo(p.latest_repo?.last_commit_at),
                }))}
              />
            )}
          </div>
        </section>
      )}

      {/* ─────────────── TODAY + ACTIVITY ─────────────── */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Today"
            title={
              <>
                What&rsquo;s in flight, <span className="italic-amber">what&rsquo;s next.</span>
              </>
            }
            action={
              <Link href="/tasks" className="text-xs font-semibold uppercase tracking-eyebrow text-green-deep hover:text-amber-deep">
                All tasks &rarr;
              </Link>
            }
          />

          <QuickTaskForm projects={allProjects} />

          {today.length === 0 ? (
            <div className="panel-quiet flex items-center gap-3 p-6 text-sm text-charcoal/60">
              <Inbox size={18} className="text-green-mid" />
              <div>
                Inbox zero across all projects. Nice. Queue work above or{' '}
                <Link href="/projects/new" className="font-semibold text-green-deep hover:text-amber-deep">
                  add a project
                </Link>
                .
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {[...inFlight, ...upNext, ...urgent].slice(0, 12).map(({ task, project }) => (
                <TaskRow key={task.id} task={task} project={project} showProject />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <ActivityFeed commits={commits} deploys={deploys} />
          <SisterToolCard pulse={socialPulse} />
        </div>
      </section>

      {/* ─────────────── PROJECTS ─────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Active projects"
          title={
            <>
              {activeProjects.length === 0
                ? 'Nothing active yet.'
                : 'On the workbench.'}
            </>
          }
          action={
            <Link href="/projects" className="text-xs font-semibold uppercase tracking-eyebrow text-green-deep hover:text-amber-deep">
              All projects &rarr;
            </Link>
          }
          count={activeProjects.length}
        />

        {noData ? (
          <FirstRunCallout />
        ) : activeProjects.length === 0 ? (
          <div className="panel-quiet p-8 text-center text-sm text-charcoal/60">
            No active projects. Promote one from{' '}
            <Link
              href="/projects"
              className="font-semibold text-green-deep hover:text-amber-deep"
            >
              the project list
            </Link>
            , or{' '}
            <Link
              href="/projects/discover"
              className="font-semibold text-green-deep hover:text-amber-deep"
            >
              discover what&rsquo;s already on disk
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeProjects.slice(0, 9).map(p => (
              <ProjectCard key={p.project.id} row={p} />
            ))}
          </div>
        )}
      </section>

      {/* ─────────────── PIPELINE STRIP ─────────────── */}
      {projectsWithLatest.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Across the workbench"
            title={
              <>
                Every project, <span className="italic-amber">every state.</span>
              </>
            }
          />
          <ProjectsByState projects={projectsWithLatest} />
        </section>
      )}
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function StatsStrip({ stats }: { stats: HubStats }) {
  const cells = [
    { label: 'Active projects', value: stats.active_projects, hint: `${stats.idea_projects} ideas, ${stats.paused_projects} paused` },
    { label: 'Open tasks', value: stats.open_tasks, hint: `${stats.in_progress_tasks} in flight, ${stats.blocked_tasks} blocked` },
    { label: 'Live deploys', value: stats.live_deploys, hint: `${stats.failing_deploys} failing` },
    { label: 'Dirty repos', value: stats.dirty_repos, hint: `${stats.stale_repos} quiet 14d+` },
  ];
  return (
    <div className="relative mt-10 grid grid-cols-2 gap-4 border-t border-cream/10 pt-6 sm:grid-cols-4">
      {cells.map(c => (
        <div key={c.label}>
          <div className="text-[10px] font-semibold uppercase tracking-eyebrow text-cream/55">
            {c.label}
          </div>
          <div className="mt-1 font-display text-4xl font-black tabular-nums leading-none tracking-display text-cream">
            {c.value}
          </div>
          <div className="mt-1 text-[11px] text-cream/55">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  count,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className="eyebrow green">
          <span>{eyebrow}</span>
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-display text-green-deep sm:text-3xl">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-3 align-middle text-base font-semibold tabular-nums text-charcoal/40">
              {count}
            </span>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

function AttentionTile({
  tone,
  icon,
  title,
  detail,
  rows,
}: {
  tone: 'bad' | 'amber' | 'quiet';
  icon: React.ReactNode;
  title: string;
  detail: string;
  rows: Array<{ name: string; slug: string; hint: string }>;
}) {
  const toneClass =
    tone === 'bad'
      ? 'border-bad/30 bg-bad/5'
      : tone === 'amber'
        ? 'border-amber-deep/30 bg-amber/8'
        : 'border-cream-dk/60 bg-cream/30';
  const accentClass =
    tone === 'bad'
      ? 'text-bad'
      : tone === 'amber'
        ? 'text-amber-deep'
        : 'text-charcoal/55';
  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className={`flex items-center gap-2 ${accentClass}`}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-eyebrow">
          {title}
        </span>
      </div>
      <div className="mt-1 font-display text-xl font-bold text-green-deep">
        {detail}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <li key={i}>
            {r.slug ? (
              <Link
                href={`/projects/${r.slug}`}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs text-charcoal hover:bg-white/60"
              >
                <span className="truncate font-medium">{r.name}</span>
                <span className={`shrink-0 font-mono text-[10px] ${accentClass}`}>
                  {r.hint}
                </span>
              </Link>
            ) : (
              <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-charcoal">
                <span className="truncate font-medium">{r.name}</span>
                <span className={`shrink-0 font-mono text-[10px] ${accentClass}`}>
                  {r.hint}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityFeed({
  commits,
  deploys,
}: {
  commits: Awaited<ReturnType<typeof listRecentCommits>>;
  deploys: Awaited<ReturnType<typeof listRecentDeploys>>;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-cream-dk/40 px-5 py-4">
        <span className="eyebrow green">
          <span>On the wire</span>
        </span>
        <Sparkles size={14} className="text-amber-deep" />
      </div>
      {commits.length === 0 && deploys.length === 0 ? (
        <div className="px-5 py-6 text-sm text-charcoal/55">
          No commits or deploys recorded yet. Run{' '}
          <code className="rounded bg-cream/60 px-1.5 py-0.5 font-mono text-[11px]">
            pnpm gh:poll
          </code>{' '}
          locally, or trigger{' '}
          <code className="rounded bg-cream/60 px-1.5 py-0.5 font-mono text-[11px]">
            POST /api/cron/refresh-monitors
          </code>{' '}
          to populate the feed.
        </div>
      ) : (
        <ul className="divide-y divide-cream-dk/40">
          {commits.slice(0, 6).map(c => (
            <li key={`c-${c.project_id}-${c.sha}`} className="flex items-start gap-3 px-5 py-3 text-sm">
              <GitCommit size={14} className="mt-0.5 shrink-0 text-green-mid" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${c.project_slug}`}
                  className="block font-semibold text-green-deep hover:text-amber-deep"
                >
                  {c.project_name}
                </Link>
                <div className="mt-0.5 truncate text-[12px] text-charcoal/65">
                  {c.message ?? '—'}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase text-charcoal/45">
                {timeAgo(c.committed_at)}
              </span>
            </li>
          ))}
          {deploys.slice(0, 4).map(d => {
            const stateClass =
              d.state === 'READY'
                ? 'text-green-mid'
                : d.state === 'ERROR'
                  ? 'text-bad'
                  : 'text-amber-deep';
            const Icon =
              d.state === 'READY' ? CheckCircle2 : d.state === 'ERROR' ? AlertCircle : Rocket;
            return (
              <li key={`d-${d.project_id}-${d.observed_at}`} className="flex items-start gap-3 px-5 py-3 text-sm">
                <Icon size={14} className={`mt-0.5 shrink-0 ${stateClass}`} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${d.project_slug}`}
                    className="block font-semibold text-green-deep hover:text-amber-deep"
                  >
                    {d.project_name}
                  </Link>
                  <div className="mt-0.5 truncate text-[12px] text-charcoal/65">
                    Deploy {d.state?.toLowerCase() ?? 'pending'}
                    {d.url ? (
                      <>
                        {' '}
                        &middot;{' '}
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-green-deep underline-offset-2 hover:underline"
                        >
                          open
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase text-charcoal/45">
                  {timeAgo(d.deployed_at ?? d.observed_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectsByState({
  projects,
}: {
  projects: Awaited<ReturnType<typeof buildProjectsWithLatest>>;
}) {
  const grouped = new Map<string, typeof projects>();
  for (const p of projects) {
    const k = p.project.state;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(p);
  }
  const order = ['active', 'idea', 'paused', 'shipped'] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {order.map(state => {
        const rows = grouped.get(state) ?? [];
        return (
          <div key={state} className="panel-quiet p-4">
            <div className="mb-3 flex items-center justify-between">
              <ProjectStateChip state={state} />
              <span className="font-mono text-[11px] tabular-nums text-charcoal/40">
                {rows.length}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-charcoal/40">—</p>
            ) : (
              <ul className="space-y-1">
                {rows.slice(0, 6).map(p => (
                  <li key={p.project.id}>
                    <Link
                      href={`/projects/${p.project.slug}`}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm text-charcoal hover:bg-white/70"
                    >
                      <span className="truncate font-medium">{p.project.name}</span>
                      {p.latest_repo?.last_commit_at && (
                        <span className="shrink-0 font-mono text-[10px] text-charcoal/40">
                          {timeAgo(p.latest_repo.last_commit_at)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FirstRunCallout() {
  return (
    <div className="grain rounded-xl border border-cream/10 bg-green-deep px-8 py-10 text-cream">
      <div className="relative max-w-3xl">
        <span className="eyebrow cream">
          <span>First run</span>
        </span>
        <h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-display">
          Nothing&rsquo;s here yet —{' '}
          <span className="italic-amber">let&rsquo;s pull it in.</span>
        </h3>
        <p className="mt-3 text-cream/75">
          Either add a project manually, or let the discover pass walk{' '}
          <code className="rounded bg-cream/10 px-1.5 py-0.5 font-mono text-[11px]">
            DEV_PROJECTS_ROOT
          </code>{' '}
          and find every git repo in your dev folder. Once the projects are in,
          run the GitHub + Vercel pollers (locally or via the cron) and the
          dashboard fills itself in.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/projects/discover" className="btn-primary">
            <Telescope size={14} />
            Discover projects
          </Link>
          <Link href="/projects/new" className="btn-on-dark">
            <Plus size={14} />
            Add manually
          </Link>
        </div>
      </div>
    </div>
  );
}
