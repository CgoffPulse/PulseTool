'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  type Task,
} from '@/lib/types';
import {
  deleteTask,
  updateTaskPriority,
  updateTaskStatus,
} from '@/lib/command/actions';
import { TaskPriorityChip, TaskStatusChip } from './state-chip';
import { cn } from '@/lib/utils';

export function TaskRow({
  task,
  showProject = false,
  showClient = false,
  showAssignee = false,
}: {
  task: Task;
  showProject?: boolean;
  showClient?: boolean;
  showAssignee?: boolean;
}) {
  const [pending, start] = useTransition();
  const isDone = task.status === 'done' || task.status === 'cancelled';
  const isUrgent = task.priority === 'p0' || task.priority === 'p1';
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isDone;

  return (
    <div
      className={cn(
        'group flex flex-wrap items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50',
        isDone && 'opacity-60',
        pending && 'opacity-50',
        isUrgent ? 'border-stone-200' : 'border-stone-200'
      )}
    >
      <button
        aria-label={isDone ? 'Reopen task' : 'Mark task done'}
        onClick={() =>
          start(() => updateTaskStatus(task.id, isDone ? 'backlog' : 'done'))
        }
        className="text-stone-400 transition-colors hover:text-green-deep"
      >
        {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-[14px] font-medium text-stone-900',
            isDone && 'line-through'
          )}
        >
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
          {showProject && task.project_slug && task.project_name && (
            <Link
              href={`/projects/${task.project_slug}`}
              className="font-medium text-green-deep hover:text-amber-deep"
            >
              {task.project_name}
            </Link>
          )}
          {showProject && !task.project_id && (
            <span className="text-stone-400">Inbox</span>
          )}
          {showClient && task.client_slug && task.client_name && (
            <Link
              href={`/clients/${task.client_slug}`}
              className="text-stone-600 hover:text-amber-deep"
            >
              {task.client_name}
            </Link>
          )}
          {showAssignee && task.assigned_person_name && (
            <span className="text-stone-600">{task.assigned_person_name}</span>
          )}
          {task.due_date && (
            <span className={cn('tabular-nums', isOverdue && 'font-medium text-bad')}>
              {isOverdue ? 'Overdue · ' : 'Due '}
              {task.due_date}
            </span>
          )}
          {task.origin !== 'manual' && (
            <span className="text-[10px] uppercase tracking-[0.08em] text-stone-400">
              {task.origin}
            </span>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <TaskPriorityChip priority={task.priority} />
        <TaskStatusChip status={task.status} />
      </div>

      <select
        value={task.priority}
        onChange={e => start(() => updateTaskPriority(task.id, e.target.value))}
        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600 focus:border-amber-mid focus:outline-none md:hidden"
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
        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600 focus:border-amber-mid focus:outline-none"
      >
        {TASK_STATUSES.map(s => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <button
        aria-label="Cancel task"
        onClick={() => {
          if (confirm(`Cancel task "${task.title}"?`)) {
            start(() => deleteTask(task.id));
          }
        }}
        className="text-stone-300 opacity-0 transition-opacity duration-150 hover:text-bad group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export { TaskPriorityChip, TaskStatusChip };
