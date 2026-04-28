'use client';

import { POST_PIPELINE, POST_STATUS_LABEL, postStatusIndex } from '@/lib/types';
import type { PostStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STAGE_TONE: Record<PostStatus, string> = {
  planned: 'bg-cream-dk text-charcoal/65',
  captured: 'bg-amber-mid text-green-deep',
  edited: 'bg-amber-deep text-cream',
  approved: 'bg-green-light text-green-deep',
  ready: 'bg-green-light text-green-deep',
  scheduled: 'bg-green-mid text-cream',
  posted: 'bg-green-deep text-cream',
};

/**
 * 6-stage pip strip showing where the post is in the production pipeline.
 * Click a pip to set the post to that stage.
 */
export function StatusPipeline({
  status,
  onChange,
  size = 'sm',
  showLabel = true,
}: {
  status: PostStatus;
  onChange?: (s: PostStatus) => void;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const idx = postStatusIndex(status);
  const dim = size === 'md' ? 'h-2.5' : 'h-2';
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1">
        {POST_PIPELINE.map((s, i) => {
          const filled = i <= idx;
          const cls = filled ? STAGE_TONE[s] : 'bg-cream-dk/60';
          const interactive = !!onChange;
          const node = (
            <span
              className={cn(
                'inline-block w-5 rounded-sm transition-colors duration-fast',
                dim,
                cls,
                interactive && 'cursor-pointer hover:ring-2 hover:ring-amber-mid/40'
              )}
              title={POST_STATUS_LABEL[s]}
            />
          );
          return interactive ? (
            <button
              key={s}
              type="button"
              onClick={() => onChange?.(s)}
              aria-label={`Set to ${POST_STATUS_LABEL[s]}`}
              className="grid place-items-center"
            >
              {node}
            </button>
          ) : (
            <span key={s}>{node}</span>
          );
        })}
      </div>
      {showLabel ? (
        <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
          {POST_STATUS_LABEL[status]}
        </span>
      ) : null}
    </div>
  );
}
