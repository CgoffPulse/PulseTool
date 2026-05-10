import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  GitBranch,
  GitCommit,
  Rocket,
} from 'lucide-react';
import {
  buildEngineeringProjectsWithLatest,
  listRecentCommits,
  listRecentDeploys,
} from '@/lib/dev/queries';
import { RefreshButton } from '@/components/dev/refresh-button';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /dev/monitors — append-only feed view of the engineering monitors.
 *
 * Shows the latest fs-snapshot, repo activity, and deployment row for every
 * monitored project. Useful when a deploy fails or a repo goes stale and you
 * want to see every signal in one place without bouncing between project pages.
 */
export default async function MonitorsPage() {
  const [projects, commits, deploys] = await Promise.all([
    buildEngineeringProjectsWithLatest(),
    listRecentCommits(30),
    listRecentDeploys(30),
  ]);

  return (
    <div className="space-y-10">
      <Link
        href="/dev"
        className="flex items-center gap-1 text-xs font-body text-green-deep/70 hover:text-amber-deep"
      >
        <ChevronLeft size={14} />
        Dev hub
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">
            <span>Monitor history</span>
          </span>
          <h1 className="mt-3 font-display text-4xl font-black tracking-display text-green-deep sm:text-5xl">
            Every signal, <span className="italic-amber">timestamped.</span>
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-charcoal/70">
            Latest GitHub, filesystem, and Vercel observations across every
            monitored engineering project. Refresh runs the pollers now;
            otherwise the cron picks up every 6 hours.
          </p>
        </div>
        <RefreshButton tone="light" />
      </header>

      {/* Snapshot table */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
          Latest snapshot per project
        </h2>
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-10 text-center text-sm text-stone-600">
            No engineering projects yet. Add one in{' '}
            <Link href="/projects" className="text-amber-deep hover:underline">
              Pulse Command
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-[0.08em] text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Last commit</th>
                  <th className="px-4 py-3 font-medium">FS</th>
                  <th className="px-4 py-3 font-medium">Last deploy</th>
                  <th className="px-4 py-3 font-medium">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(row => {
                  const dirty = row.latest_fs?.is_dirty === true;
                  const deployBad = row.latest_deployment?.state === 'ERROR';
                  return (
                    <tr
                      key={row.project.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${row.project.slug}`}
                          className="font-medium text-stone-900 hover:text-amber-deep"
                        >
                          {row.project.name}
                        </Link>
                        {row.project.github_repo && (
                          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
                            <GitBranch size={11} />
                            {row.project.github_repo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.latest_repo?.last_commit_at ? (
                          <div>
                            <div className="text-stone-700">
                              {timeAgo(row.latest_repo.last_commit_at)}
                            </div>
                            {row.latest_repo.last_commit_message && (
                              <div className="mt-0.5 line-clamp-1 font-mono text-[11px] text-stone-500">
                                {row.latest_repo.last_commit_message}
                              </div>
                            )}
                            {row.latest_repo.open_pr_count !== null && (
                              <div className="mt-0.5 text-[11px] text-stone-500">
                                {row.latest_repo.open_pr_count} PR · {row.latest_repo.open_issue_count ?? 0} issues
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.latest_fs ? (
                          <div>
                            <span
                              className={
                                dirty
                                  ? 'inline-flex items-center gap-1 rounded-full bg-amber-mid/30 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-amber-deep'
                                  : 'inline-flex items-center gap-1 rounded-full bg-green-mid/15 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-green-deep'
                              }
                            >
                              {dirty ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                              {dirty
                                ? `${row.latest_fs.uncommitted_files ?? '?'} files`
                                : 'clean'}
                            </span>
                            {row.latest_fs.current_branch && (
                              <div className="mt-0.5 font-mono text-[11px] text-stone-500">
                                {row.latest_fs.current_branch}
                              </div>
                            )}
                            <div className="text-[11px] text-stone-500">
                              {timeAgo(row.latest_fs.observed_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.latest_deployment ? (
                          <div>
                            <span
                              className={
                                deployBad
                                  ? 'inline-flex items-center gap-1 rounded-full bg-bad/10 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-bad'
                                  : row.latest_deployment.state === 'READY'
                                    ? 'inline-flex items-center gap-1 rounded-full bg-green-mid/15 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-green-deep'
                                    : 'inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-stone-700'
                              }
                            >
                              <Rocket size={10} />
                              {row.latest_deployment.state ?? 'pending'}
                            </span>
                            {row.latest_deployment.deployed_at && (
                              <div className="mt-0.5 text-[11px] text-stone-500">
                                {timeAgo(row.latest_deployment.deployed_at)}
                              </div>
                            )}
                            {row.latest_deployment.url && (
                              <a
                                href={row.latest_deployment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 block truncate font-mono text-[11px] text-green-deep hover:text-amber-deep"
                              >
                                {row.latest_deployment.url.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-stone-700">
                          <span className="font-mono tabular-nums">
                            {row.open_task_count}
                          </span>{' '}
                          open
                        </div>
                        {row.in_progress_task_count > 0 && (
                          <div className="text-[11px] text-amber-deep">
                            {row.in_progress_task_count} active
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold tracking-tight text-stone-900">
            Recent commits
          </h2>
          {commits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-8 text-center text-sm text-stone-500">
              No commits recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {commits.map(c => (
                <li
                  key={`c-${c.project_id}-${c.sha}`}
                  className="flex items-start gap-3 px-4 py-3 text-sm"
                >
                  <GitCommit size={14} className="mt-0.5 shrink-0 text-green-mid" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/projects/${c.project_slug}`}
                      className="block font-medium text-stone-900 hover:text-amber-deep"
                    >
                      {c.project_name}
                    </Link>
                    <div className="mt-0.5 truncate text-[12px] text-stone-600">
                      {c.message ?? '—'}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-stone-400">
                    {timeAgo(c.committed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold tracking-tight text-stone-900">
            Recent deploys
          </h2>
          {deploys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-8 text-center text-sm text-stone-500">
              No deployments recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {deploys.map(d => {
                const Icon =
                  d.state === 'READY'
                    ? CheckCircle2
                    : d.state === 'ERROR'
                      ? AlertCircle
                      : Rocket;
                const colour =
                  d.state === 'READY'
                    ? 'text-green-mid'
                    : d.state === 'ERROR'
                      ? 'text-bad'
                      : 'text-amber-deep';
                return (
                  <li
                    key={`d-${d.project_id}-${d.observed_at}`}
                    className="flex items-start gap-3 px-4 py-3 text-sm"
                  >
                    <Icon size={14} className={`mt-0.5 shrink-0 ${colour}`} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${d.project_slug}`}
                        className="block font-medium text-stone-900 hover:text-amber-deep"
                      >
                        {d.project_name}
                      </Link>
                      <div className="mt-0.5 text-[12px] text-stone-600">
                        Deploy {d.state?.toLowerCase() ?? 'pending'}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-stone-400">
                      {timeAgo(d.deployed_at ?? d.observed_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
