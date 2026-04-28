import { cn } from '@/lib/utils';
import {
  PROJECT_STATE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  type ProjectState,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/types';

const projectStateClass: Record<ProjectState, string> = {
  idea: 'bg-idea/15 text-idea',
  active: 'bg-active/15 text-active',
  paused: 'bg-paused/15 text-paused',
  shipped: 'bg-shipped/15 text-shipped',
  archived: 'bg-archived/15 text-archived',
};

const taskStatusClass: Record<TaskStatus, string> = {
  backlog: 'bg-slate-500/15 text-slate-300',
  next: 'bg-sky/15 text-sky',
  in_progress: 'bg-indigo/20 text-indigo-soft',
  blocked: 'bg-bad/15 text-bad',
  done: 'bg-active/15 text-active',
  cancelled: 'bg-archived/15 text-archived line-through',
};

const taskPriorityClass: Record<TaskPriority, string> = {
  p0: 'bg-bad/15 text-bad',
  p1: 'bg-warn/15 text-warn',
  p2: 'bg-slate-500/15 text-slate-300',
  p3: 'bg-slate-500/10 text-slate-400',
};

export function ProjectStateChip({ state }: { state: ProjectState }) {
  return (
    <span className={cn('chip', projectStateClass[state])}>
      {PROJECT_STATE_LABEL[state]}
    </span>
  );
}

export function TaskStatusChip({ status }: { status: TaskStatus }) {
  return (
    <span className={cn('chip', taskStatusClass[status])}>
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

export function TaskPriorityChip({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn('chip', taskPriorityClass[priority])}>
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}
