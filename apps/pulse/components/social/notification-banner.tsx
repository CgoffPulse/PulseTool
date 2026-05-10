import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Bell, Info } from 'lucide-react';
import { listOpenNotifications } from '@/lib/social/queries';
import {
  NOTIFICATION_KIND_LABEL,
  type NotificationKind,
  type NotificationRow,
  type NotificationSeverity,
} from '@/lib/social/types';
import { cn } from '@/lib/social/utils';

/**
 * Inline notification banner shown above planning, production, and client
 * overview pages. Surfaces the action engine's open notifications scoped to
 * the current client and (optionally) month — silently absent when there's
 * nothing to attend to.
 *
 * Server component: reads from Supabase directly, filters in memory because
 * the existing `listOpenNotifications` already returns the full open set
 * (small N) and lets us filter without bypassing the audience-routing logic
 * the read helper otherwise applies.
 */
export async function NotificationBanner({
  clientId,
  monthId,
}: {
  clientId?: string;
  monthId?: string;
}) {
  let notifications: NotificationRow[] = [];
  try {
    const all = await listOpenNotifications();
    notifications = all.filter(n => {
      if (clientId && n.related_client_id !== clientId) return false;
      if (monthId && n.related_month_id !== monthId) return false;
      return true;
    });
  } catch {
    // Silently absent on read failure — the page itself will surface auth /
    // schema errors. Banner is a best-effort addition, never a blocker.
    return null;
  }

  if (notifications.length === 0) return null;

  // Surface the worst severity first so the banner's tint reflects the most
  // urgent thing inside it.
  const ranked = [...notifications].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity)
  );

  if (ranked.length >= 4) {
    return <CollapsedBanner notifications={ranked} />;
  }

  const peakSeverity = ranked[0].severity;
  return (
    <section
      aria-label="Action engine alerts"
      className={cn(
        'rounded-lg border bg-cream-lt/60',
        borderClass(peakSeverity)
      )}
    >
      <header className="flex items-baseline justify-between gap-4 px-5 pt-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal/55">
          <SeverityIcon severity={peakSeverity} />
          {eyebrowLabel(peakSeverity)}
        </div>
        <Link
          href="/notifications"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-label text-charcoal/55 transition-colors duration-fast hover:text-green-deep"
        >
          See all
          <ArrowUpRight size={12} />
        </Link>
      </header>
      <ul className="divide-y divide-cream-dk/40 px-5 pb-3 pt-2">
        {ranked.map(n => (
          <BannerRow key={n.id} n={n} />
        ))}
      </ul>
    </section>
  );
}

function CollapsedBanner({ notifications }: { notifications: NotificationRow[] }) {
  const peak = notifications[0].severity;
  const counts = notifications.reduce(
    (acc, n) => {
      acc[n.severity] = (acc[n.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<NotificationSeverity, number>
  );
  const breakdown: string[] = [];
  if (counts.bad) breakdown.push(`${counts.bad} priority`);
  if (counts.warn) breakdown.push(`${counts.warn} watch`);
  if (counts.info) breakdown.push(`${counts.info} info`);

  return (
    <section
      aria-label="Action engine alerts"
      className={cn(
        'rounded-lg border bg-cream-lt/60',
        borderClass(peak)
      )}
    >
      <Link
        href="/notifications"
        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-fast hover:bg-cream-lt"
      >
        <div className="flex items-center gap-3">
          <SeverityIcon severity={peak} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal/55">
              {eyebrowLabel(peak)}
            </div>
            <div className="mt-0.5 font-display text-[15px] font-semibold leading-tight text-green-deep">
              {notifications.length} items need your attention this week
            </div>
            {breakdown.length > 0 ? (
              <div className="mt-0.5 text-[13px] text-charcoal/60">
                {breakdown.join(' · ')}
              </div>
            ) : null}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-label text-charcoal/55 group-hover:text-green-deep">
          Open
          <ArrowUpRight size={12} />
        </span>
      </Link>
    </section>
  );
}

function BannerRow({ n }: { n: NotificationRow }) {
  const kindLabel =
    NOTIFICATION_KIND_LABEL[n.kind as NotificationKind] ?? n.kind;
  const href = n.link_url ?? '/notifications';
  return (
    <li className="py-3 first:pt-2 last:pb-1">
      <Link
        href={href}
        className="group flex items-start justify-between gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal/45">
            {kindLabel}
          </div>
          <div className="mt-0.5 font-display text-[15px] font-semibold leading-tight text-green-deep">
            {n.title}
          </div>
          {n.detail ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-charcoal/60">
              {n.detail}
            </p>
          ) : null}
        </div>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] uppercase tracking-label text-charcoal/45 transition-colors duration-fast group-hover:text-green-deep">
          Open
          <ArrowUpRight size={12} />
        </span>
      </Link>
    </li>
  );
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  const tone =
    severity === 'bad'
      ? 'text-bad'
      : severity === 'warn'
      ? 'text-amber-deep'
      : 'text-green-deep';
  if (severity === 'bad') return <AlertTriangle size={13} className={tone} />;
  if (severity === 'warn') return <Bell size={13} className={tone} />;
  return <Info size={13} className={tone} />;
}

function severityWeight(s: NotificationSeverity): number {
  if (s === 'bad') return 3;
  if (s === 'warn') return 2;
  return 1;
}

function borderClass(s: NotificationSeverity): string {
  // Subtle severity-tinted left border (4px). Right/top/bottom stay neutral
  // hairline so the banner sits politely above heavier UI like the planning
  // grid. `bad` reserves the earthy red; `warn` is the brand amber; `info`
  // is a quiet stone hairline (no left tint).
  if (s === 'bad') return 'border-cream-dk/60 border-l-4 border-l-bad/60';
  if (s === 'warn') return 'border-cream-dk/60 border-l-4 border-l-amber-mid/70';
  return 'border-cream-dk/60';
}

function eyebrowLabel(s: NotificationSeverity): string {
  if (s === 'bad') return 'Needs attention';
  if (s === 'warn') return 'Heads up';
  return 'For your info';
}
