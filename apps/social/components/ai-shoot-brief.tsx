'use client';

import { useState } from 'react';
import { Sparkles, X, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefResponse {
  ok: boolean;
  brief: string;
  stub: boolean;
  model: string | null;
  error: string | null;
}

export function AiShootBrief({
  frame,
  captures,
  linkedPosts,
  clientId,
  onAccept,
  className,
}: {
  frame: string;
  captures: string;
  linkedPosts: string;
  clientId?: string | null;
  onAccept: (brief: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/llm/shoot-brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          frame,
          captures,
          linked_posts: linkedPosts,
          client_id: clientId ?? null,
          used_in: 'shotlist',
        }),
      });
      const json = (await res.json()) as BriefResponse;
      setResult(json);
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

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-amber-mid/50 bg-amber-light/30 px-3 py-1.5 text-xs uppercase tracking-label text-amber-deep hover:bg-amber-mid/30',
          className
        )}
      >
        <Sparkles size={12} />
        Pre-shoot brief
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 px-4 py-8 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cream-dk bg-cream shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-cream-dk/60 px-6 py-5">
              <div>
                <div className="eyebrow">Pre-shoot · brand voice</div>
                <h3 className="mt-2 font-display text-xl font-bold text-green-deep">
                  What we're <span className="italic text-amber-deep">actually</span> here for
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

            <div className="space-y-4 px-6 py-5">
              {loading && (
                <div className="flex items-center gap-2.5 text-sm text-charcoal/55">
                  <RefreshCw size={14} className="animate-spin" />
                  Drafting brief…
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
                      Voice gateway not configured — showing a stub brief.
                    </div>
                  )}
                  <p className="whitespace-pre-wrap rounded-md border border-cream-dk bg-white px-4 py-3 text-sm leading-relaxed text-charcoal">
                    {result.brief}
                  </p>
                </>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-cream-dk/60 bg-cream-lt/40 px-6 py-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs text-charcoal/65 hover:text-charcoal disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  if (result?.brief) onAccept(result.brief);
                  setOpen(false);
                }}
                disabled={!result?.brief}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal disabled:opacity-40"
              >
                <Check size={11} />
                Drop into notes
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
