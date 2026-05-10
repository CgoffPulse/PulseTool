import { CalendarRange, ExternalLink, ImagePlus, Users } from 'lucide-react';
import type { SocialPulse } from '@/lib/dev/social-bridge';

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
      className="group block overflow-hidden rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Sister tool
        </span>
        <ExternalLink
          size={12}
          className="text-stone-300 group-hover:text-stone-500"
        />
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-stone-900">
        Pulse Social
      </h3>
      <p className="mt-1 text-xs text-stone-500">
        The content production hub. Same database, different schema.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div
            key={s.label}
            className="rounded-md border border-stone-200 bg-cream-lt p-3"
          >
            <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-stone-500">
              {s.icon}
              {s.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-stone-900">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </a>
  );
}
