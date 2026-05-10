import { cn } from '@/lib/utils';
import {
  CLIENT_TIER_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  WORK_KIND_LABEL,
  WORK_STATE_LABEL,
  type ClientTier,
  type TaskPriority,
  type TaskStatus,
  type WorkKind,
  type WorkState,
} from '@/lib/types';

const baseChip =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]';

const workStateClass: Record<WorkState, string> = {
  idea: 'border-stone-200 bg-stone-50 text-stone-600',
  active: 'border-green-mid/30 bg-green-mid/10 text-green-deep',
  paused: 'border-amber-deep/30 bg-amber/10 text-amber-deep',
  shipped: 'border-green-deep/30 bg-green-deep/10 text-green-deep',
  archived: 'border-stone-200 bg-stone-50 text-stone-500',
};

const taskStatusClass: Record<TaskStatus, string> = {
  backlog: 'border-stone-200 bg-stone-50 text-stone-600',
  next: 'border-green-light/40 bg-green-light/10 text-green-deep',
  in_progress: 'border-amber-deep/30 bg-amber/10 text-amber-deep',
  blocked: 'border-bad/30 bg-bad/10 text-bad',
  done: 'border-green-mid/30 bg-green-mid/10 text-green-mid',
  cancelled: 'border-stone-200 bg-stone-50 text-stone-400 line-through',
};

const taskPriorityClass: Record<TaskPriority, string> = {
  p0: 'border-bad/40 bg-bad/10 text-bad',
  p1: 'border-amber-deep/30 bg-amber/10 text-amber-deep',
  p2: 'border-stone-200 bg-stone-50 text-stone-600',
  p3: 'border-stone-200 bg-stone-50 text-stone-400',
};

const workKindClass: Record<WorkKind, string> = {
  client_campaign: 'border-green-mid/30 bg-green-mid/10 text-green-deep',
  internal_build: 'border-stone-300 bg-stone-50 text-stone-700',
  onboarding: 'border-amber-deep/30 bg-amber/10 text-amber-deep',
  service_engagement: 'border-green-deep/30 bg-green-deep/10 text-green-deep',
};

const tierClass: Record<ClientTier, string> = {
  premium: 'border-amber-deep/30 bg-amber/10 text-amber-deep',
  mid: 'border-green-mid/30 bg-green-mid/10 text-green-deep',
  productized: 'border-stone-300 bg-stone-50 text-stone-700',
};

export function ProjectStateChip({ state }: { state: WorkState }) {
  return <span className={cn(baseChip, workStateClass[state])}>{WORK_STATE_LABEL[state]}</span>;
}

export function TaskStatusChip({ status }: { status: TaskStatus }) {
  return <span className={cn(baseChip, taskStatusClass[status])}>{TASK_STATUS_LABEL[status]}</span>;
}

export function TaskPriorityChip({ priority }: { priority: TaskPriority }) {
  return <span className={cn(baseChip, taskPriorityClass[priority])}>{TASK_PRIORITY_LABEL[priority]}</span>;
}

export function WorkKindChip({ kind }: { kind: WorkKind }) {
  return <span className={cn(baseChip, workKindClass[kind])}>{WORK_KIND_LABEL[kind]}</span>;
}

export function ClientTierChip({ tier }: { tier: ClientTier }) {
  return <span className={cn(baseChip, tierClass[tier])}>{CLIENT_TIER_LABEL[tier]}</span>;
}
