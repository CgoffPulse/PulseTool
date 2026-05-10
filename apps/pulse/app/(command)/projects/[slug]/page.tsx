import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, ExternalLink, GitBranch, Rocket } from 'lucide-react';
import { TaskRow } from '@/components/task-row';
import { ProjectStateChip, WorkKindChip } from '@/components/state-chip';
import { QuickTaskForm } from '@/components/quick-task-form';
import {
  getProject,
  getProjectDevLinks,
  listPeople,
  listTasks,
} from '@/lib/command/queries';
import { TASK_STATUS_LABEL, type TaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS: TaskStatus[] = ['in_progress', 'next', 'blocked', 'backlog', 'done'];

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const [tasks, people, devLinks] = await Promise.all([
    listTasks({ project_id: project.id, limit: 200 }),
    listPeople(),
    project.kind === 'internal_build' ? getProjectDevLinks(project.id) : null,
  ]);

  const grouped: Record<TaskStatus, typeof tasks> = {
    backlog: [],
    next: [],
    in_progress: [],
    blocked: [],
    done: [],
    cancelled: [],
  };
  for (const t of tasks) grouped[t.status].push(t);

  const ship = project.target_ship_date;
  const days = ship ? Math.ceil((new Date(ship).getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/projects"
          className="self-start text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          ← All projects
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <WorkKindChip kind={project.kind} />
          <ProjectStateChip state={project.state} />
          {project.client_name && project.kind !== 'internal_build' && (
            <Link
              href={`/clients/${project.client_slug}`}
              className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-50"
            >
              {project.client_name}
            </Link>
          )}
          {project.department_name && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600">
              {project.department_name}
            </span>
          )}
        </div>

        <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-900">
          {project.name}
        </h1>

        {project.summary && (
          <p className="max-w-3xl text-[15px] leading-[1.55] text-stone-700">{project.summary}</p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open tasks" value={String(project.open_task_count)} />
        <Stat label="Active" value={String(project.in_progress_task_count)} />
        {project.assigned_person_name ? (
          <Stat label="Assigned" value={project.assigned_person_name} />
        ) : (
          <Stat label="Assigned" value="—" muted />
        )}
        {ship ? (
          <Stat
            label="Target ship"
            value={ship}
            hint={days !== null ? (days < 0 ? `${-days}d overdue` : `in ${days}d`) : undefined}
          />
        ) : (
          <Stat label="Target ship" value="—" muted />
        )}
      </section>

      {project.current_focus && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
            Current focus
          </div>
          <p className="text-[14px] leading-[1.55] text-stone-800">{project.current_focus}</p>
        </section>
      )}

      {devLinks && (devLinks.latest_deployment || devLinks.latest_repo) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {devLinks.latest_deployment && (
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                <Rocket size={12} />
                Latest deploy
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-mono text-[13px] text-stone-900">
                  {devLinks.latest_deployment.state ?? '—'}
                </div>
                {devLinks.latest_deployment.deployed_at && (
                  <div className="font-mono text-[11px] tabular-nums text-stone-500">
                    {devLinks.latest_deployment.deployed_at.slice(0, 16).replace('T', ' ')}
                  </div>
                )}
              </div>
              {devLinks.latest_deployment.url && (
                <a
                  href={devLinks.latest_deployment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[12px] text-green-deep hover:text-amber-deep"
                >
                  <ExternalLink size={11} />
                  {devLinks.latest_deployment.url.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}
          {devLinks.latest_repo && (
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                <GitBranch size={12} />
                Repo
              </div>
              {devLinks.latest_repo.last_commit_message && (
                <p className="line-clamp-2 text-[13px] text-stone-800">
                  {devLinks.latest_repo.last_commit_message}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px] tabular-nums text-stone-500">
                {devLinks.latest_repo.last_commit_at && (
                  <span>{devLinks.latest_repo.last_commit_at.slice(0, 10)}</span>
                )}
                {devLinks.latest_repo.open_pr_count !== null && (
                  <span>{devLinks.latest_repo.open_pr_count} PR open</span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
            Tasks
          </h2>
          <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500 tabular-nums">
            {tasks.length} total
          </span>
        </div>

        <QuickTaskForm
          project={{ id: project.id }}
          people={people.map(p => ({ id: p.id, name: p.name }))}
        />

        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-12 text-center">
            <p className="text-[14px] text-stone-600">No tasks yet — add the first one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {STATUS_GROUPS.map(s => {
              const rows = grouped[s];
              if (rows.length === 0) return null;
              return (
                <div key={s} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-stone-500">
                      {TASK_STATUS_LABEL[s]}
                    </h3>
                    <span className="text-[11px] tabular-nums text-stone-400">{rows.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {rows.map(t => (
                      <TaskRow key={t.id} task={t} showAssignee />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {label}
      </div>
      <div
        className={
          muted
            ? 'mt-1.5 font-display text-2xl font-semibold tracking-tight text-stone-300'
            : 'mt-1.5 font-display text-2xl font-semibold tracking-tight text-stone-900 tabular-nums'
        }
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] tabular-nums text-stone-500">{hint}</div>
      )}
    </div>
  );
}

// Suppress the unused import warning when ArrowUpRight isn't rendered.
void ArrowUpRight;
