import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { getMorningDiff } from '@/lib/queries';
import { timeAgo } from '@/lib/format';
import { SinceControl } from './_since-control';

interface Props {
  searchParams: Promise<{ since?: string }>;
}

const SOURCE_LABEL: Record<string, string> = {
  crm: 'CRM',
  social: 'Social',
  dev: 'Dev',
  voice: 'Voice',
  analytics: 'Analytics',
};

const SOURCE_CHIP: Record<string, string> = {
  crm: 'bg-amber-mid/25 text-amber-deep',
  social: 'bg-green-mid/20 text-green-deep',
  dev: 'bg-cream/60 text-charcoal/80',
  voice: 'bg-amber/15 text-amber-deep',
  analytics: 'bg-green-deep/10 text-green-deep',
};

export default async function MorningPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sinceISO =
    sp.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const entries = await getMorningDiff(sinceISO);

  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const d = typeof e.at === 'string' ? new Date(e.at) : (e.at as unknown as Date);
    const key = Number.isNaN(d.getTime())
      ? 'unknown'
      : d.toISOString().slice(0, 10);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Bridge
        </Link>
        <span className="eyebrow mt-3">Morning</span>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-display text-green-deep">
          What&apos;s <span className="italic-amber">changed</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-charcoal/65">
          A diff of every tool since the timestamp below. Refresh as often as
          you like — your last-viewed time is stored locally.
        </p>
      </div>

      <SinceControl initialSince={sinceISO} />

      <section className="flex flex-col gap-6">
        {entries.length === 0 ? (
          <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/60 p-12 text-center">
            <Sparkles size={28} className="mb-3 text-amber-deep" />
            <h2 className="font-display text-2xl font-bold text-green-deep">
              Nothing has <span className="italic-amber">changed</span>.
            </h2>
            <p className="mt-2 max-w-md text-sm text-charcoal/65">
              Either nobody has touched anything since this point, or all the
              tools needed for that schema are not yet wired in.
            </p>
          </div>
        ) : (
          [...grouped.entries()].map(([day, items]) => (
            <div key={day} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">
                  {new Date(day).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                  {items.length} change{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <ol className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
                {items.map((e, i) => (
                  <li
                    key={`${e.source}-${e.at}-${i}`}
                    className="grid grid-cols-[88px_72px_1fr_88px] items-start gap-3 border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/55 tabular-nums">
                      {timeAgo(e.at)}
                    </span>
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow ${SOURCE_CHIP[e.source] ?? ''}`}
                    >
                      {SOURCE_LABEL[e.source] ?? e.source}
                    </span>
                    <span className="min-w-0 flex-1 text-charcoal/85">
                      <div className="truncate font-semibold text-green-deep">
                        {e.title}
                      </div>
                      {e.detail && (
                        <div className="truncate text-xs text-charcoal/55">
                          {e.detail}
                        </div>
                      )}
                    </span>
                    {e.link && (
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] uppercase tracking-eyebrow text-amber-deep hover:text-charcoal"
                      >
                        Open →
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
