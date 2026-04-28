'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
import { updateLead } from '@/lib/actions';

export function NotesForm({ leadId, initial }: { leadId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form
      action={(fd: FormData) => {
        start(async () => {
          await updateLead(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        });
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={leadId} />
      <textarea
        name="notes"
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={6}
        placeholder="Notes — anything that doesn't belong in a touch. Goals, gotchas, decision-makers."
        className="input resize-y"
      />
      <div className="flex items-center justify-between text-[11px] text-charcoal/55">
        <span>{saved ? 'Saved' : 'Auto-save off — hit Save when ready'}</span>
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? <Loader2 size={14} className="spin-slow" /> : <Save size={14} />}
          Save notes
        </button>
      </div>
    </form>
  );
}
