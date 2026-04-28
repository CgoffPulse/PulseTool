import { listAllTasks, listProjects } from '@/lib/queries';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import { TASK_STATUSES, TASK_STATUS_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([listAllTasks(), listProjects()]);
  const projectsById = new Map(projects.map(p => [p.id, p]));

  const grouped = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!grouped.has(t.status)) grouped.set(t.status, []);
    grouped.get(t.status)!.push(t);
  }

  const open = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-50">All tasks</h1>
        <p className="mt-1 text-sm text-slate-400">
          {open.length} open · {tasks.length} total across {projects.length} project
          {projects.length === 1 ? '' : 's'}.
        </p>
      </header>

      <QuickTaskForm projects={projects} />

      <div className="space-y-8">
        {TASK_STATUSES.filter(s => s !== 'cancelled').map(s => {
          const rows = grouped.get(s);
          if (!rows || rows.length === 0) return null;
          return (
            <section key={s}>
              <h2 className="mb-3 text-2xs uppercase tracking-eyebrow text-slate-400">
                {TASK_STATUS_LABEL[s]} <span className="text-slate-600">·</span>{' '}
                <span className="font-mono">{rows.length}</span>
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
          <div className="panel-quiet p-12 text-center text-sm text-slate-400">
            No tasks yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
