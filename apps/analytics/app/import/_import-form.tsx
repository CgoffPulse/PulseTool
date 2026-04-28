'use client';

import { useState, useTransition } from 'react';
import { Upload } from 'lucide-react';
import { runImportCsv } from '@/lib/actions';
import type { SocialClient } from '@/lib/types';

export function ImportForm({ clients }: { clients: SocialClient[] }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const r = await runImportCsv(formData);
        setFeedback(r.message);
        if (r.ok) setCsv('');
      } catch (err) {
        setFeedback(`Failed: ${(err as Error).message}`);
      }
    });
  };

  if (clients.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
        No clients available. Add one on the social side first.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
          Client
        </label>
        <select
          name="client_id"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="select"
          required
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
          CSV body
        </label>
        <textarea
          name="csv"
          required
          minLength={10}
          maxLength={2_000_000}
          placeholder="Paste the CSV export from Instagram or Facebook here. First row should contain headers like date, reach, impressions, profile_visits, follower_count, …"
          className="input h-64 resize-y font-mono text-xs leading-body"
          value={csv}
          onChange={e => setCsv(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-charcoal/55">
          Idempotent on (account, date) — re-importing the same range overwrites null cells only.
        </p>
        <button
          type="submit"
          disabled={isPending || csv.length < 10}
          className="btn-primary"
        >
          <Upload size={14} /> {isPending ? 'Importing…' : 'Import'}
        </button>
      </div>
      {feedback && (
        <div className="rounded-md border border-cream-dk/60 bg-white p-3 text-sm">
          {feedback}
        </div>
      )}
    </form>
  );
}
