import { CalendarRange, ExternalLink, ImagePlus, Users } from 'lucide-react';
import type { SocialPulse } from '@/lib/social-bridge';

const SOCIAL_URL =
  process.env.NEXT_PUBLIC_SOCIAL_URL || 'https://pulse-tool-mauve.vercel.app';

export function SisterToolCard({ pulse }: { pulse: SocialPulse | null }) {
  if (!pulse) return null;

  const stats = [
    {
      label: 'Active clients',
      value: pulse.active_clients,
      icon: <Users size={12} />,
    },
    {
      label: 'Open shoots',
      value: pulse.open_shoots,
      icon: <CalendarRange size={12} />,
    },
    {
      label: 'Open posts',
      value: pulse.open_posts,
      icon: <ImagePlus size={12} />,
    },
    {
      label: 'Posted 30d',
      value: pulse.posted_last_30d,
      icon: <ImagePlus size={12} />,
    },
  ];

  return (
    <a
      href={SOCIAL_URL}
      target="_blank"
      rel="noreferrer"
      className="group panel block overflow-hidden p-5 transition-all duration-fast hover:border-amber-mid/50 hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow green">
          <span>Sister tool</span>
        </span>
        <ExternalLink
          size={12}
          className="text-charcoal/40 group-hover:text-amber-deep"
        />
      </div>
      <h3 className="mt-3 font-display text-xl font-bold tracking-display text-green-deep">
        Pulse <span className="italic-amber">Social</span>
      </h3>
      <p className="mt-1 text-xs text-charcoal/60">
        The content production hub. Same database, different schema.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div
            key={s.label}
            className="rounded-md border border-cream-dk/50 bg-cream-lt p-3"
          >
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal/55">
              {s.icon}
              {s.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-green-deep">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </a>
  );
}
