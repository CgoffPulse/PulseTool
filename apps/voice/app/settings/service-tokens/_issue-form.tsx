'use client';

import { useState, useTransition } from 'react';
import { Copy, Plus } from 'lucide-react';
import { issueServiceToken } from '@/lib/actions';

const SCOPES = [
  { id: 'llm:run', label: 'llm:run', desc: 'Free-form prompt' },
  { id: 'llm:structured', label: 'llm:structured', desc: 'Structured output' },
];

export function IssueTokenForm() {
  const [isPending, startTransition] = useTransition();
  const [issued, setIssued] = useState<{ token: string; id: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        const result = await issueServiceToken(fd);
        setIssued(result);
        form.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function copyToken() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {issued && (
        <div className="rounded-md border border-amber-mid/40 bg-amber/10 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-amber-deep">
                Token issued — copy it now
              </span>
              <span className="text-xs text-charcoal/65">
                This is the only time you&apos;ll see the unhashed value. Store
                it as <code className="font-mono">VOICE_SERVICE_TOKEN</code> in
                the calling app.
              </span>
            </div>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-mid bg-amber-mid px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal hover:bg-amber-deep hover:text-cream-lt"
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 overflow-auto rounded-md border border-charcoal/20 bg-charcoal p-3 font-mono text-xs text-cream-lt">
            {issued.token}
          </pre>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input
            type="text"
            name="label"
            required
            placeholder="e.g. analytics-prod"
            className="input"
          />
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-cream-dk/40 bg-cream/30 px-3 py-2">
            {SCOPES.map(s => (
              <label
                key={s.id}
                className="inline-flex items-center gap-2 text-xs"
              >
                <input
                  type="checkbox"
                  name="scopes"
                  value={s.id}
                  defaultChecked
                  className="h-3.5 w-3.5 accent-amber-deep"
                />
                <span className="font-mono text-[11px] text-charcoal/85">
                  {s.label}
                </span>
                <span className="text-[10px] text-charcoal/55">{s.desc}</span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary disabled:opacity-50"
          >
            <Plus size={14} /> {isPending ? 'Issuing…' : 'Issue token'}
          </button>
        </div>
        {error && <p className="text-xs text-bad">{error}</p>}
      </form>
    </div>
  );
}
