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
  const isUrgent = task.priority === 'p0' || task.priority === 'p1';
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isDone;

  return (
    <div
      className={cn(
        'group flex flex-wrap items-center gap-3 rounded-md border bg-white px-3 py-2.5 shadow-sm transition-all duration-fast ease-pulse hover:shadow-card',
        isDone && 'opacity-60',
        pending && 'opacity-50',
        isUrgent
          ? 'border-amber-deep/30 hover:border-amber-deep/60'
          : 'border-cream-dk/60 hover:border-cream-dk'
      )}
    >
      <button
        aria-label={isDone ? 'Reopen task' : 'Mark task done'}
        onClick={() =>
          start(() => updateTaskStatus(task.id, isDone ? 'backlog' : 'done'))
        }
        className="text-charcoal/40 transition-colors hover:text-green-mid"
      >
        {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-sm font-semibold text-charcoal',
            isDone && 'line-through'
          )}
        >
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-charcoal/50">
          {showProject && project && (
            <Link
              href={`/projects/${project.slug}`}
              className="font-medium text-green-deep hover:text-amber-deep"
            >
              {project.name}
            </Link>
          )}
          {showProject && !project && task.project_id === null && (
            <span className="text-charcoal/40">— Inbox</span>
          )}
          {task.due_date && (
            <span
              className={cn(isOverdue && 'font-semibold text-bad')}
            >
              {isOverdue ? 'Overdue · ' : 'Due '}
              {task.due_date}
            </span>
          )}
        </div>
      </div>

      <div className="hidden md:contents">
        <TaskPriorityChip priority={task.priority} />
        <TaskStatusChip status={task.status} />
      </div>

      <select
        value={task.priority}
        onChange={e => start(() => updateTaskPriority(task.id, e.target.value))}
        className="rounded-md border border-cream-dk/60 bg-cream-lt px-2 py-1 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/70 focus:border-amber-mid focus:outline-none md:hidden"
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
        className="rounded-md border border-cream-dk/60 bg-cream-lt px-2 py-1 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/70 focus:border-amber-mid focus:outline-none"
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
        className="text-charcoal/35 opacity-0 transition-opacity duration-fast hover:text-bad group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export { TaskPriorityChip, TaskStatusChip };
