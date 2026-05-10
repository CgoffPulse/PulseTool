'use client';

import { useState, useTransition } from 'react';
import { Check, X as XIcon } from 'lucide-react';
import { decideApproval } from '@/lib/command-actions';
import type { ApprovalDecision } from '@/lib/types';

export function ApprovalDecisionForm({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(status: ApprovalDecision) {
    setError(null);
    start(async () => {
      // Default approver = christian (Q8: Christian is sole approver in v1).
      const result = await decideApproval(id, { approver: 'christian', status });
      if (!result.ok) setError(result.error ?? 'Failed');
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('changes_requested')}
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          <XIcon size={12} />
          Changes
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('approved')}
          className="inline-flex items-center gap-1 rounded-md bg-green-deep px-3 py-1.5 text-[12px] font-medium text-cream-lt transition-colors hover:bg-green-mid disabled:opacity-50"
        >
          <Check size={12} />
          Approve
        </button>
      </div>
      {error && <span className="text-[11px] text-bad">{error}</span>}
    </div>
  );
}
