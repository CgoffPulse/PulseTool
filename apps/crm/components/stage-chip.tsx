import { cn } from '@/lib/utils';
import type { LeadStage } from '@/lib/types';

const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const STAGE_CLASS: Record<LeadStage, string> = {
  new: 'border border-cream-dk/70 bg-cream/50 text-charcoal/80',
  qualified: 'bg-amber/15 text-amber-deep',
  proposal: 'bg-amber-mid/25 text-amber-deep',
  negotiation: 'bg-green-mid/20 text-green-deep',
  won: 'bg-green-deep text-cream-lt',
  lost: 'bg-bad/15 text-bad',
};

export function StageChip({
  stage,
  size = 'md',
}: {
  stage: LeadStage;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-eyebrow',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        STAGE_CLASS[stage]
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function stageLabel(stage: LeadStage): string {
  return STAGE_LABEL[stage];
}
