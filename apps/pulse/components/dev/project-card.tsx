import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  GitCommit,
  Rocket,
} from 'lucide-react';
import type { MonitoredProjectWithLatest } from '@/lib/dev/types';
import { ProjectStateChip } from '@/components/state-chip';
import { timeAgo } from '@/lib/utils';

/**
 * Engineering-flavored project card — surfaces dirty repo / failing deploy /
 * stale commit indicators that the generic command card doesn't. Used on the
 * /dev home and (when listed) /dev/monitors.
 */
export function ProjectCard({ row }: { row: MonitoredProjectWithLatest }) {
  const { project, latest_repo, latest_fs, latest_deployment } = row;
  const dirty = latest_fs?.is_dirty === true;
  const deployBad = latest_deployment?.state === 'ERROR';
  const deployGood = latest_deployment?.state === 'READY';
  const stale =
    !!latest_repo?.last_commit_at &&
    Date.now() - new Date(latest_repo.last_commit_at).getTime() >
      14 * 24 * 60 * 60 * 1000;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-semibold tracking-tight text-stone-900">
            {project.name}
          </h3>
          {project.current_focus && (
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">
              {project.current_focus}
            </p>
          )}
        </div>
        <ProjectStateChip state={project.state as 'idea' | 'active' | 'paused' | 'shipped' | 'archived'} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-stone-500">
        {project.github_repo && (
          <span className="flex items-center gap-1.5">
            <GitBranch size={11} />
            <span className="font-mono">{project.github_repo}</span>
          </span>
        )}
        {latest_repo?.last_commit_at && (
          <span
            className={`flex items-center gap-1.5 ${stale ? 'text-amber-deep' : ''}`}
          >
            <GitCommit size={11} />
            {timeAgo(latest_repo.last_commit_at)}
          </span>
        )}
        {row.open_task_count > 0 && (
          <span>
            <span className="font-semibold tabular-nums text-stone-700">
              {row.open_task_count}
            </span>{' '}
            open
            {row.in_progress_task_count > 0 && (
              <>
                {' · '}
                <span className="font-semibold tabular-nums text-stone-700">
                  {row.in_progress_task_count}
                </span>{' '}
                active
              </>
            )}
          </span>
        )}
      </div>

      {(dirty || deployBad || deployGood) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-mid/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-deep">
              <AlertCircle size={10} />
              Uncommitted
            </span>
          )}
          {deployBad && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bad/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-bad">
              <Rocket size={10} />
              Deploy failing
            </span>
          )}
          {deployGood && !deployBad && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-mid/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-deep">
              <CheckCircle2 size={10} />
              Live
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
