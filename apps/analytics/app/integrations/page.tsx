import Link from 'next/link';
import { Camera, Plug, Share } from 'lucide-react';
import { listAllAccounts } from '@/lib/queries';
import { listClientsForAnalytics } from '@/lib/social-bridge';
import { Ga4Form } from './_ga4-form';
import { metaConfigured } from '@/lib/ingest/meta';
import { ga4Configured } from '@/lib/ingest/ga4';
import { isVoiceGatewayConfigured } from '@/lib/voice-gateway';
import { timeAgo } from '@/lib/format';

interface Props {
  searchParams: Promise<{ connected?: string; pages?: string; error?: string }>;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[integrations] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function IntegrationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [clients, accounts] = await Promise.all([
    safe(listClientsForAnalytics, [] as Awaited<ReturnType<typeof listClientsForAnalytics>>),
    safe(listAllAccounts, [] as Awaited<ReturnType<typeof listAllAccounts>>),
  ]);

  const accountsByClient = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const arr = accountsByClient.get(a.client_id) ?? [];
    arr.push(a);
    accountsByClient.set(a.client_id, arr);
  }

  const flags = {
    meta: metaConfigured(),
    ga4: ga4Configured(),
    voice: isVoiceGatewayConfigured(),
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-cream-dk/60 pb-4">
        <span className="eyebrow">Integrations</span>
        <h1 className="font-display text-4xl font-bold text-green-deep">
          Hook up the <span className="italic-amber">data</span>.
        </h1>
        <p className="text-sm text-charcoal/65 max-w-2xl">
          Connect Instagram + Facebook via Meta OAuth, paste a GA4 property ID per client. Pulse
          ingests every 6 hours from there.
        </p>
      </header>

      {sp.error && (
        <div className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {sp.error}
        </div>
      )}
      {sp.connected && (
        <div className="rounded-md border border-green-mid/40 bg-green-mid/10 p-3 text-sm text-green-deep">
          Connected {sp.connected} account{sp.connected === '1' ? '' : 's'} across {sp.pages ?? '?'}{' '}
          page{sp.pages === '1' ? '' : 's'}.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <FlagTile label="Meta (IG + FB)" ok={flags.meta} hint="META_APP_ID + META_APP_SECRET" />
        <FlagTile
          label="Google Analytics 4"
          ok={flags.ga4}
          hint="GA4_SERVICE_ACCOUNT_B64 (base64 JSON)"
        />
        <FlagTile
          label="Voice gateway (AI)"
          ok={flags.voice}
          hint="VOICE_GATEWAY_URL + VOICE_GATEWAY_TOKEN"
        />
      </section>

      <section className="flex flex-col gap-4">
        <span className="eyebrow">Clients</span>
        {clients.length === 0 ? (
          <p className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
            No clients found in the social schema. Add a client there first; Pulse Analytics
            will read it via slug.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {clients.map(c => {
              const own = accountsByClient.get(c.id) ?? [];
              return (
                <div key={c.id} className="panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/clients/${c.slug}`}
                        className="font-display text-xl font-bold text-green-deep hover:text-amber-deep"
                      >
                        {c.name}
                      </Link>
                      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                        {c.slug}
                      </div>
                    </div>
                    <span className="chip-cream">{own.length} account(s)</span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {own.length === 0 && (
                      <p className="text-xs text-charcoal/55">
                        No accounts connected for this client yet.
                      </p>
                    )}
                    {own.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-cream-dk/50 bg-cream/20 px-3 py-2 text-xs"
                      >
                        <span className="flex items-center gap-2">
                          {a.platform === 'instagram' ? (
                            <Camera size={12} />
                          ) : a.platform === 'facebook' ? (
                            <Share size={12} />
                          ) : (
                            <Plug size={12} />
                          )}
                          <span className="font-mono">
                            {a.platform} / {a.handle ?? a.external_id ?? '—'}
                          </span>
                        </span>
                        <span className="text-charcoal/55">
                          {a.status} · {timeAgo(a.last_synced_at)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <Link
                      href={`/api/integrations/meta/connect?client_id=${c.id}`}
                      className="inline-flex w-fit items-center gap-2 rounded-md border border-green-deep/20 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep hover:border-green-deep/40 hover:bg-cream/30"
                    >
                      <Camera size={12} /> / <Share size={12} /> Connect via Meta OAuth
                    </Link>
                    <div>
                      <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                        GA4 property
                      </span>
                      <Ga4Form clientId={c.id} clientName={c.name} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function FlagTile({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        ok
          ? 'border-green-mid/40 bg-green-mid/10 text-green-deep'
          : 'border-cream-dk bg-white/70 text-charcoal/65'
      }`}
    >
      <div className="text-[10px] uppercase tracking-eyebrow opacity-70">{label}</div>
      <div className="mt-1 font-display text-lg font-bold">
        {ok ? 'Configured' : 'Missing keys'}
      </div>
      <div className="mt-1 font-mono text-[10px]">{hint}</div>
    </div>
  );
}
