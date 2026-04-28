'use client';

import { useTransition } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { promoteLead } from '@/lib/actions';

export function PromoteButton({ leadId, alreadyPromoted }: { leadId: string; alreadyPromoted: boolean }) {
  const [pending, start] = useTransition();
  if (alreadyPromoted) {
    return (
      <span className="chip-green">Already a client</span>
    );
  }
  return (
    <form
      action={(fd: FormData) => {
        start(() => {
          void promoteLead(fd);
        });
      }}
    >
      <input type="hidden" name="id" value={leadId} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? <Loader2 size={14} className="spin-slow" /> : <UserPlus size={14} />}
        Promote to client
      </button>
    </form>
  );
}
