import { TopBar } from './top-bar';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-lt">
      <TopBar />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-20">{children}</main>
      <footer className="mt-12 border-t border-cream-dk/50 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-charcoal/60 sm:flex-row sm:items-center">
          <span>
            <span className="font-display text-base font-bold text-green-deep">
              Pulse <span className="italic-amber font-display">analytics</span>
            </span>{' '}
            {process.env.NEXT_PUBLIC_SOCIAL_URL ? (
              <>
                &middot; sister tool to{' '}
                <a
                  href={process.env.NEXT_PUBLIC_SOCIAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
                >
                  Pulse Social
                </a>
                .{' '}
              </>
            ) : (
              <>&middot;{' '}</>
            )}
            Bentonville, AR. Built for ourselves.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
            Performance &middot; insights &middot; recommendations
          </span>
        </div>
      </footer>
    </div>
  );
}
