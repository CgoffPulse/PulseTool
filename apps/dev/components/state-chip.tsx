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
  idea: 'border border-rust-200/40 bg-rust-100/15 text-rust-300',
  active: 'border border-green-mid/30 bg-green-mid/15 text-green-deep',
  paused: 'border border-amber-deep/30 bg-amber/15 text-amber-deep',
  shipped: 'border border-green-deep/30 bg-green-deep/10 text-green-deep',
  archived: 'border border-cream-dk/70 bg-cream/40 text-charcoal/55',
};

const taskStatusClass: Record<TaskStatus, string> = {
  backlog: 'border border-cream-dk/70 bg-cream/40 text-charcoal/65',
  next: 'border border-green-light/40 bg-green-light/15 text-green-deep',
  in_progress: 'border border-amber-deep/40 bg-amber/20 text-amber-deep',
  blocked: 'border border-bad/40 bg-bad/10 text-bad',
  done: 'border border-green-mid/30 bg-green-mid/10 text-green-mid',
  cancelled: 'border border-cream-dk/60 bg-cream/30 text-charcoal/40 line-through',
};

const taskPriorityClass: Record<TaskPriority, string> = {
  p0: 'border border-bad/40 bg-bad/10 text-bad',
  p1: 'border border-amber-deep/40 bg-amber/15 text-amber-deep',
  p2: 'border border-cream-dk/60 bg-cream/30 text-charcoal/65',
  p3: 'border border-cream-dk/40 bg-cream/20 text-charcoal/45',
};

const baseChip =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow';

export function ProjectStateChip({
  state,
  size = 'md',
}: {
  state: ProjectState;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        baseChip,
        size === 'sm' && 'px-1.5 py-0 text-[9px]',
        projectStateClass[state]
      )}
    >
      {PROJECT_STATE_LABEL[state]}
    </span>
  );
}

export function TaskStatusChip({ status }: { status: TaskStatus }) {
  return (
    <span className={cn(baseChip, taskStatusClass[status])}>
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

export function TaskPriorityChip({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn(baseChip, taskPriorityClass[priority])}>
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}
