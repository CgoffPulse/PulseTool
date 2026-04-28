import Link from 'next/link';
import {
  AlertCircle,
  GitBranch,
  GitCommit,
  Rocket,
  CheckCircle2,
} from 'lucide-react';
import type { ProjectWithLatest } from '@/lib/types';
import { ProjectStateChip } from './state-chip';
import { timeAgo } from '@/lib/utils';

export function ProjectCard({ row }: { row: ProjectWithLatest }) {
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
      className="group panel relative block overflow-hidden p-5 transition-all duration-fast ease-pulse hover:-translate-y-0.5 hover:border-amber-mid/50 hover:shadow-lift"
    >
      <span
        aria-hidden
        className="watermark absolute -right-3 -bottom-6 select-none text-[88px]"
      >
        {project.name.slice(0, 2).toUpperCase()}
      </span>

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-bold tracking-display text-green-deep">
            {project.name}
          </h3>
          {project.current_focus && (
            <p className="mt-1 line-clamp-2 text-sm text-charcoal/70">
              {project.current_focus}
            </p>
          )}
        </div>
        <ProjectStateChip state={project.state} />
      </div>

      <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-charcoal/55">
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
            <span className="font-semibold tabular-nums text-charcoal/75">
              {row.open_task_count}
            </span>{' '}
            open
            {row.in_progress_task_count > 0 && (
              <>
                {' · '}
                <span className="font-semibold tabular-nums text-charcoal/75">
                  {row.in_progress_task_count}
                </span>{' '}
                active
              </>
            )}
          </span>
        )}
      </div>

      {(dirty || deployBad || deployGood) && (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {dirty && (
            <span className="chip-amber">
              <AlertCircle size={10} />
              Uncommitted
            </span>
          )}
          {deployBad && (
            <span className="chip-bad">
              <Rocket size={10} />
              Deploy failing
            </span>
          )}
          {deployGood && !deployBad && (
            <span className="chip-green">
              <CheckCircle2 size={10} />
              Live
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
