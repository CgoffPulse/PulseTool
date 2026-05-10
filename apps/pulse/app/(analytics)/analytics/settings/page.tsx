import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { isVoiceGatewayConfigured } from '@/lib/analytics/voice-gateway';
import { metaConfigured } from '@/lib/analytics/meta';
import { ga4Configured } from '@/lib/analytics/ga4';

const TEMPLATES = [
  {
    slug: 'analytics-insight',
    name: 'Performance insight',
    purpose: 'Daily 150-word narrative per client',
  },
  {
    slug: 'analytics-recommendation',
    name: 'Performance recommendation',
    purpose: '3–5 typed actions for the next two weeks',
  },
  {
    slug: 'analytics-tag-post',
    name: 'Auto-tag a post',
    purpose: 'Pillar / hook style / format quality classification',
  },
  {
    slug: 'analytics-chart-pick',
    name: 'AI auto-visualize',
    purpose: 'Chart-spec picker for the Ask page',
  },
];

export default async function SettingsPage() {
  const voiceUrl = process.env.VOICE_GATEWAY_URL ?? '';
  const voiceLink = voiceUrl
    ? `${voiceUrl.replace(/\/$/, '')}/templates?applies_to_prefix=analytics_`
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-cream-dk/60 pb-4">
        <span className="eyebrow">Settings</span>
        <h1 className="font-display text-4xl font-bold text-green-deep">
          Templates &amp; <span className="italic-amber">config</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Pulse Analytics doesn't own prompt templates — they live in the voice gateway. Edits
          there propagate everywhere instantly.
        </p>
      </header>

      <section className="panel p-6">
        <span className="eyebrow">Voice gateway</span>
        <div className="mt-3 flex flex-col gap-2 text-sm text-charcoal/85">
          <div>
            Status:{' '}
            <span className={isVoiceGatewayConfigured() ? 'chip-green' : 'chip-amber'}>
              {isVoiceGatewayConfigured() ? 'configured' : 'stub mode'}
            </span>
          </div>
          {voiceLink ? (
            <Link
              href={voiceLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
            >
              Open templates in Voice <ExternalLink size={12} />
            </Link>
          ) : (
            <p className="text-xs text-charcoal/55">
              Set <span className="font-mono">VOICE_GATEWAY_URL</span> to enable a deep link.
            </p>
          )}
        </div>
      </section>

      <section className="panel p-6">
        <span className="eyebrow">Templates this app calls</span>
        <ul className="mt-3 flex flex-col gap-2">
          {TEMPLATES.map(t => (
            <li
              key={t.slug}
              className="flex items-center justify-between rounded-md border border-cream-dk/50 bg-cream/15 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-mono text-[12px]">{t.slug}</span>
                <span className="ml-2 text-charcoal/70">{t.name}</span>
              </span>
              <span className="text-[11px] uppercase tracking-eyebrow text-charcoal/55">
                {t.purpose}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <FlagTile label="Meta (IG + FB)" ok={metaConfigured()} />
        <FlagTile label="Google Analytics 4" ok={ga4Configured()} />
        <FlagTile label="Voice gateway" ok={isVoiceGatewayConfigured()} />
      </section>
    </div>
  );
}

function FlagTile({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={`rounded-md border p-4 text-sm ${
        ok
          ? 'border-green-mid/40 bg-green-mid/10 text-green-deep'
          : 'border-cream-dk bg-white/60 text-charcoal/65'
      }`}
    >
      <div className="text-[10px] uppercase tracking-eyebrow opacity-70">{label}</div>
      <div className="mt-1 font-display text-base font-bold">
        {ok ? 'Configured' : 'Missing keys'}
      </div>
    </div>
  );
}
