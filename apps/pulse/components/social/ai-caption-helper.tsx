'use client';

import { useState } from 'react';
import { Sparkles, X, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/social/utils';

interface CaptionResponse {
  ok: boolean;
  variants: string[];
  raw: string;
  stub: boolean;
  model: string | null;
  error: string | null;
}

export function AiCaptionHelper({
  draft,
  notes,
  clientId,
  onAccept,
  className,
}: {
  draft: string;
  notes?: string;
  clientId?: string | null;
  onAccept: (caption: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/llm/caption', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          draft,
          notes: notes ?? '',
          client_id: clientId ?? null,
          used_in: 'planning-grid.row',
        }),
      });
      const json = (await res.json()) as CaptionResponse;
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
          'inline-flex items-center gap-1 rounded-md border border-amber-mid/40 bg-amber-light/30 px-1.5 py-0.5 text-[10px] uppercase tracking-eyebrow text-amber-deep transition-colors duration-fast hover:bg-amber-mid/30',
          className
        )}
        aria-label="AI caption helper"
        title="Rewrite with AI"
      >
        <Sparkles size={10} />
        AI
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <header className="flex items-start justify-between gap-4 border-b border-cream-dk/60 px-6 py-5">
            <div>
              <div className="eyebrow">Caption · brand voice</div>
              <h3 className="mt-2 font-display text-xl font-bold text-green-deep">
                Three <span className="italic text-amber-deep">on-brand</span> rewrites
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
            <DraftPreview draft={draft} />

            {loading && <Spinner label="Calling Voice gateway…" />}

            {error && (
              <div className="rounded-md border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
                {error}
              </div>
            )}

            {result && (
              <>
                {result.stub && (
                  <div className="rounded-md border border-amber-mid/40 bg-amber-light/30 px-4 py-2.5 text-xs text-amber-deep">
                    Voice gateway not configured — showing stub variants. Set
                    VOICE_GATEWAY_URL + VOICE_GATEWAY_TOKEN to enable real output.
                  </div>
                )}
                <ul className="space-y-2.5">
                  {result.variants.length === 0 && (
                    <li className="text-sm text-charcoal/55">
                      No variants returned. Raw output:
                      <pre className="mt-2 whitespace-pre-wrap rounded-md border border-cream-dk bg-cream-lt p-3 text-xs">
                        {result.raw}
                      </pre>
                    </li>
                  )}
                  {result.variants.map((v, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-md border border-cream-dk/60 bg-cream-lt/40 px-4 py-3"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-deep text-[10px] font-semibold text-cream">
                        {i + 1}
                      </span>
                      <p className="flex-1 text-sm leading-relaxed text-charcoal">
                        {v}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onAccept(v);
                          setOpen(false);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-green-deep px-3 py-1.5 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
                      >
                        <Check size={11} />
                        Use
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <footer className="flex items-center justify-between gap-4 border-t border-cream-dk/60 bg-cream-lt/40 px-6 py-3 text-xs text-charcoal/55">
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-charcoal/65 hover:text-charcoal disabled:opacity-40"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Try again
            </button>
            {result?.model && (
              <span className="font-mono text-[10px]">{result.model}</span>
            )}
          </footer>
        </Modal>
      )}
    </>
  );
}

function DraftPreview({ draft }: { draft: string }) {
  if (!draft) {
    return (
      <div className="rounded-md border border-dashed border-cream-dk px-4 py-3 text-xs text-charcoal/55">
        No draft yet. Voice will use the brand brief and any notes to seed three
        captions you can edit from.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-cream-dk bg-white px-4 py-3">
      <div className="eyebrow text-[9px]">Your draft</div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-charcoal/85">
        {draft}
      </p>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-charcoal/55">
      <RefreshCw size={14} className="animate-spin" />
      {label}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cream-dk bg-cream shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
