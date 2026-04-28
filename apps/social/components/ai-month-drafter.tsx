'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CONTENT_TYPE_LABEL, type ContentType, type Pillar } from '@/lib/types';
import { bulkCreatePosts } from '@/lib/actions';
import { cn } from '@/lib/utils';

interface DraftedPost {
  post_date: string;
  content_type: ContentType;
  pillar: Pillar | null;
  description: string;
}

interface DraftMonthResponse {
  ok: boolean;
  drafts: DraftedPost[];
  raw: string;
  stub: boolean;
  model: string | null;
  error: string | null;
}

export function AiMonthDrafter({
  monthId,
  monthSlug,
  clientSlug,
  clientId,
  month,
  pillarMix,
  quotas,
  holidays,
  notes,
  hasExistingPosts,
}: {
  monthId: string;
  monthSlug: string;
  clientSlug: string;
  clientId?: string | null;
  month: string; // YYYY-MM
  pillarMix: string;
  quotas: string;
  holidays: string;
  notes: string;
  hasExistingPosts: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<DraftMonthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/llm/draft-month', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          month,
          pillar_mix: pillarMix,
          quotas,
          holidays,
          notes,
          client_id: clientId ?? null,
          used_in: 'planning-page.empty-month',
        }),
      });
      const json = (await res.json()) as DraftMonthResponse;
      setResult(json);
      // Default-select all returned drafts.
      setSelected(new Set(json.drafts.map((_, i) => i)));
      if (!json.ok && json.error) setError(json.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const onOpen = () => {
    setOpen(true);
    if (!result && !loading) void run();
  };

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const onCommit = async () => {
    if (!result) return;
    const drafts = result.drafts
      .filter((_, i) => selected.has(i))
      .map(d => ({
        post_date: d.post_date,
        content_type: d.content_type,
        pillar: d.pillar,
        description: d.description,
      }));
    if (drafts.length === 0) return;
    setCommitting(true);
    try {
      await bulkCreatePosts({
        month_id: monthId,
        client_slug: clientSlug,
        month_slug: monthSlug,
        drafts,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to insert posts');
    } finally {
      setCommitting(false);
    }
  };

  const sortedIndices = useMemo(() => {
    if (!result) return [];
    return [...result.drafts.keys()].sort((a, b) =>
      result.drafts[a].post_date.localeCompare(result.drafts[b].post_date)
    );
  }, [result]);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-amber-mid"
      >
        <Sparkles size={12} />
        Draft month with AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 px-4 py-8 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-cream-dk bg-cream shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-cream-dk/60 px-6 py-5">
              <div>
                <div className="eyebrow">Month drafter · brand voice</div>
                <h3 className="mt-2 font-display text-xl font-bold text-green-deep">
                  A <span className="italic text-amber-deep">first pass</span> at {month}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-charcoal/55 hover:bg-cream-lt hover:text-charcoal"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>

            <div className="space-y-3 overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {hasExistingPosts && !result && !loading && (
                <div className="flex items-start gap-2.5 rounded-md border border-amber-mid/40 bg-amber-light/30 px-4 py-3 text-xs text-amber-deep">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    This month already has posts. The drafter will <em>add</em>,
                    not replace — uncheck anything that conflicts before
                    committing.
                  </span>
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-2.5 text-sm text-charcoal/55">
                  <RefreshCw size={14} className="animate-spin" />
                  Drafting {month}…
                </div>
              )}

              {error && (
                <div className="rounded-md border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
                  {error}
                </div>
              )}

              {result && (
                <>
                  {result.stub && (
                    <div className="rounded-md border border-amber-mid/40 bg-amber-light/30 px-4 py-2.5 text-xs text-amber-deep">
                      Voice gateway not configured — showing a stub draft.
                    </div>
                  )}

                  {result.drafts.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-charcoal/65">
                        No structured drafts could be parsed. Raw output:
                      </p>
                      <pre className="whitespace-pre-wrap rounded-md border border-cream-dk bg-white p-3 text-xs text-charcoal/85">
                        {result.raw}
                      </pre>
                    </div>
                  )}

                  {result.drafts.length > 0 && (
                    <ul className="divide-y divide-cream-dk/60 rounded-md border border-cream-dk bg-white">
                      {sortedIndices.map(i => {
                        const d = result.drafts[i];
                        const checked = selected.has(i);
                        return (
                          <li key={i} className="flex items-start gap-3 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(i)}
                              className="mt-1 h-4 w-4 rounded border-cream-dk text-green-deep focus:ring-amber-mid/40"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                                <span className="font-mono tabular-nums text-charcoal">
                                  {format(parseISO(d.post_date), 'EEE MMM d')}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                                    'border-amber-mid/50 bg-amber-light/30 text-amber-deep'
                                  )}
                                >
                                  {CONTENT_TYPE_LABEL[d.content_type]}
                                </span>
                                {d.pillar && (
                                  <span className="rounded-md border border-green-mid/40 bg-green-mid/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-deep">
                                    {d.pillar.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm leading-snug text-charcoal/85">
                                {d.description}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-cream-dk/60 bg-cream-lt/40 px-6 py-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={loading || committing}
                className="inline-flex items-center gap-1.5 text-xs text-charcoal/65 hover:text-charcoal disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Try again
              </button>
              <button
                type="button"
                onClick={() => void onCommit()}
                disabled={committing || loading || !result || selected.size === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal disabled:opacity-40"
              >
                <Check size={11} />
                {committing ? 'Creating…' : `Create ${selected.size} post${selected.size === 1 ? '' : 's'}`}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
