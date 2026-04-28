'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  type Project,
  type Task,
} from '@/lib/types';
import {
  deleteTask,
  updateTaskPriority,
  updateTaskStatus,
} from '@/lib/actions';
import { TaskPriorityChip, TaskStatusChip } from './state-chip';
import { cn } from '@/lib/utils';

export function TaskRow({
  task,
  project,
  showProject = false,
}: {
  task: Task;
  project?: Project | null;
  showProject?: boolean;
}) {
  const [pending, start] = useTransition();
  const isDone = task.status === 'done' || task.status === 'cancelled';

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-md border border-slate-500/15 bg-ink-mid/40 px-3 py-2 transition-colors duration-fast hover:border-slate-500/30',
        isDone && 'opacity-60',
        pending && 'opacity-50'
      )}
    >
      <button
        aria-label={isDone ? 'Reopen task' : 'Mark task done'}
        onClick={() =>
          start(() =>
            updateTaskStatus(task.id, isDone ? 'backlog' : 'done')
          )
        }
        className="text-slate-400 transition-colors hover:text-active"
      >
        {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-sm font-medium text-slate-100',
            isDone && 'line-through'
          )}
        >
          {task.title}
        </div>
        {(showProject || task.due_date) && (
          <div className="mt-0.5 flex items-center gap-2 text-2xs text-slate-400">
            {showProject && project && (
              <Link
                href={`/projects/${project.slug}`}
                className="hover:text-indigo-soft"
              >
                {project.name}
              </Link>
            )}
            {showProject && !project && task.project_id === null && (
              <span className="text-slate-500">— Inbox</span>
            )}
            {task.due_date && <span>· due {task.due_date}</span>}
          </div>
        )}
      </div>

      <select
        value={task.priority}
        onChange={e => start(() => updateTaskPriority(task.id, e.target.value))}
        className="rounded border border-slate-500/20 bg-ink-mid px-2 py-1 text-2xs uppercase tracking-eyebrow text-slate-300 focus:border-indigo-soft focus:outline-none"
      >
        {TASK_PRIORITIES.map(p => (
          <option key={p} value={p}>
            {TASK_PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>

      <select
        value={task.status}
        onChange={e => start(() => updateTaskStatus(task.id, e.target.value))}
        className="rounded border border-slate-500/20 bg-ink-mid px-2 py-1 text-2xs uppercase tracking-eyebrow text-slate-300 focus:border-indigo-soft focus:outline-none"
      >
        {TASK_STATUSES.map(s => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <button
        aria-label="Delete task"
        onClick={() => {
          if (confirm(`Delete task "${task.title}"?`)) {
            start(() => deleteTask(task.id));
          }
        }}
        className="text-slate-500 opacity-0 transition-opacity duration-fast hover:text-bad group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export { TaskPriorityChip, TaskStatusChip };
