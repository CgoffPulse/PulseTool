import { pingAll } from '@/lib/health';

export async function HealthFooter() {
  const results = await pingAll();
  return (
    <footer className="mt-12 border-t border-cream-dk/50 bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-4 px-6 py-6 text-xs text-charcoal/60 sm:flex-row sm:items-center">
        <span>
          <span className="font-display text-base font-bold text-green-deep">
            Pulse <span className="italic-amber font-display">huddle</span>
          </span>{' '}
          &middot; one screen across the agency. Bentonville, AR.
        </span>
        <ul className="flex flex-wrap items-center gap-3">
          {results.map(h => (
            <li key={h.app} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  !h.url
                    ? 'bg-charcoal/25'
                    : h.ok && h.db === 'ok'
                    ? 'bg-green-mid'
                    : h.ok
                    ? 'bg-amber-mid'
                    : 'bg-bad'
                }`}
                aria-hidden
              />
              {h.url ? (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/70 hover:text-amber-deep"
                >
                  {h.app}
                </a>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/40">
                  {h.app}·off
                </span>
              )}
              {h.url && (
                <span className="font-mono text-[10px] tabular-nums text-charcoal/40">
                  {h.latencyMs}ms
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
