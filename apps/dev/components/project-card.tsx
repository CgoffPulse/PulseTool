import Link from 'next/link';
import { GitBranch, AlertCircle, Rocket, GitCommit } from 'lucide-react';
import type { ProjectWithLatest } from '@/lib/types';
import { ProjectStateChip } from './state-chip';
import { timeAgo } from '@/lib/utils';

export function ProjectCard({ row }: { row: ProjectWithLatest }) {
  const { project, latest_repo, latest_fs, latest_deployment } = row;
  const dirty = latest_fs?.is_dirty === true;
  const stale =
    !!latest_repo?.last_commit_at &&
    Date.now() - new Date(latest_repo.last_commit_at).getTime() >
      14 * 24 * 60 * 60 * 1000;
  const deployBad = latest_deployment?.state === 'ERROR';

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="panel block p-5 transition-all duration-fast hover:border-indigo-soft/40 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-slate-50">
            {project.name}
          </h3>
          {project.current_focus && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-300">
              {project.current_focus}
            </p>
          )}
        </div>
        <ProjectStateChip state={project.state} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
        {project.github_repo && (
          <span className="flex items-center gap-1.5">
            <GitBranch size={12} />
            <span className="font-mono">{project.github_repo}</span>
          </span>
        )}
        {latest_repo?.last_commit_at && (
          <span className="flex items-center gap-1.5">
            <GitCommit size={12} />
            <span className={stale ? 'text-warn' : ''}>
              {timeAgo(latest_repo.last_commit_at)}
            </span>
          </span>
        )}
        {row.open_task_count > 0 && (
          <span>
            {row.open_task_count} open
            {row.in_progress_task_count > 0 &&
              ` · ${row.in_progress_task_count} active`}
          </span>
        )}
      </div>

      {(dirty || deployBad) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {dirty && (
            <span className="chip bg-warn/15 text-warn">
              <AlertCircle size={10} />
              Uncommitted changes
            </span>
          )}
          {deployBad && (
            <span className="chip bg-bad/15 text-bad">
              <Rocket size={10} />
              Deploy failing
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
