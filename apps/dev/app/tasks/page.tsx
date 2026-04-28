import Link from 'next/link';
import { Flame } from 'lucide-react';
import { listAllTasks, listProjects } from '@/lib/queries';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import { TASK_STATUS_LABEL, type Task, type Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KANBAN_COLUMNS: Array<{ status: Task['status']; tone: string }> = [
  { status: 'in_progress', tone: 'border-amber-deep/40 bg-amber/8' },
  { status: 'next', tone: 'border-green-light/40 bg-green-light/8' },
  { status: 'blocked', tone: 'border-bad/40 bg-bad/5' },
  { status: 'backlog', tone: 'border-cream-dk/60 bg-cream/30' },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const view = params.view === 'list' ? 'list' : 'board';

  const [tasks, projects] = await Promise.all([listAllTasks(), listProjects()]);
  const projectsById = new Map(projects.map(p => [p.id, p]));

  const open = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdue = open.filter(t => t.due_date && t.due_date < todayIso);
  const urgent = open.filter(t => t.priority === 'p0' || t.priority === 'p1');
  const dueSoon = open.filter(t => {
    if (!t.due_date || t.due_date < todayIso) return false;
    const days =
      (new Date(t.due_date).getTime() - new Date(todayIso).getTime()) /
      (24 * 60 * 60 * 1000);
    return days >= 0 && days <= 7;
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">
            <span>Tasks</span>
          </span>
          <h1 className="mt-3 font-display text-4xl font-black tracking-display text-green-deep sm:text-5xl">
            All work, <span className="italic-amber">in flight.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-charcoal/65">
            <span className="font-semibold text-charcoal/85">{open.length}</span>{' '}
            open · <span className="font-mono">{tasks.length}</span> total across{' '}
            <span className="font-mono">{projects.length}</span> project
            {projects.length === 1 ? '' : 's'}.
          </p>
        </div>
        <ViewToggle view={view} />
      </header>

      <QuickTaskForm projects={projects} />

      {(urgent.length > 0 || overdue.length > 0 || dueSoon.length > 0) && (
        <section className="grid gap-3 md:grid-cols-3">
          {urgent.length > 0 && (
            <SweepTile
              title="Urgent"
              count={urgent.length}
              tone="amber"
              hint="P0 and P1 tasks, not yet shipped."
            />
          )}
          {overdue.length > 0 && (
            <SweepTile
              title="Overdue"
              count={overdue.length}
              tone="bad"
              hint="Past their due date."
            />
          )}
          {dueSoon.length > 0 && (
            <SweepTile
              title="Due in 7 days"
              count={dueSoon.length}
              tone="quiet"
              hint="Approaching the deadline."
            />
          )}
        </section>
      )}

      {view === 'board' ? (
        <BoardView tasks={tasks} projectsById={projectsById} />
      ) : (
        <ListView tasks={tasks} projectsById={projectsById} />
      )}
    </div>
  );
}

function ViewToggle({ view }: { view: 'board' | 'list' }) {
  return (
    <nav className="inline-flex items-center gap-1 rounded-md border border-cream-dk/60 bg-white p-1">
      <Link
        href="/tasks?view=board"
        className={`rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow ${
          view === 'board'
            ? 'bg-green-deep text-cream'
            : 'text-charcoal/65 hover:bg-cream/50'
        }`}
      >
        Board
      </Link>
      <Link
        href="/tasks?view=list"
        className={`rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow ${
          view === 'list'
            ? 'bg-green-deep text-cream'
            : 'text-charcoal/65 hover:bg-cream/50'
        }`}
      >
        List
      </Link>
    </nav>
  );
}

function SweepTile({
  title,
  count,
  tone,
  hint,
}: {
  title: string;
  count: number;
  tone: 'amber' | 'bad' | 'quiet';
  hint: string;
}) {
  const toneClass =
    tone === 'bad'
      ? 'border-bad/30 bg-bad/5 text-bad'
      : tone === 'amber'
        ? 'border-amber-deep/30 bg-amber/8 text-amber-deep'
        : 'border-cream-dk/60 bg-cream/30 text-charcoal/65';
  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-eyebrow">
        <Flame size={14} />
        {title}
      </div>
      <div className="mt-1 font-display text-3xl font-bold tabular-nums text-green-deep">
        {count}
      </div>
      <div className="mt-0.5 text-[11px] text-charcoal/55">{hint}</div>
    </div>
  );
}

function BoardView({
  tasks,
  projectsById,
}: {
  tasks: Task[];
  projectsById: Map<string, Project>;
}) {
  const grouped = new Map<Task['status'], Task[]>();
  for (const t of tasks) {
    if (!grouped.has(t.status)) grouped.set(t.status, []);
    grouped.get(t.status)!.push(t);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLUMNS.map(col => {
        const rows = grouped.get(col.status) ?? [];
        return (
          <div
            key={col.status}
            className={`rounded-md border ${col.tone} p-3`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
                {TASK_STATUS_LABEL[col.status]}
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-charcoal/40">
                {rows.length}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="px-2 py-3 text-xs text-charcoal/40">—</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map(t => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    project={t.project_id ? projectsById.get(t.project_id) ?? null : null}
                    showProject
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListView({
  tasks,
  projectsById,
}: {
  tasks: Task[];
  projectsById: Map<string, Project>;
}) {
  const grouped = new Map<Task['status'], Task[]>();
  for (const t of tasks) {
    if (!grouped.has(t.status)) grouped.set(t.status, []);
    grouped.get(t.status)!.push(t);
  }
  return (
    <div className="space-y-8">
      {(['in_progress', 'next', 'blocked', 'backlog', 'done'] as const).map(s => {
        const rows = grouped.get(s);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={s}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/55">
              {TASK_STATUS_LABEL[s]}{' '}
              <span className="ml-2 font-mono tabular-nums text-charcoal/35">
                {rows.length}
              </span>
            </h2>
            <div className="space-y-1.5">
              {rows.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  project={t.project_id ? projectsById.get(t.project_id) ?? null : null}
                  showProject
                />
              ))}
            </div>
          </section>
        );
      })}
      {tasks.length === 0 && (
        <div className="panel-quiet p-12 text-center text-sm text-charcoal/55">
          No tasks yet. Add one above.
        </div>
      )}
    </div>
  );
}
