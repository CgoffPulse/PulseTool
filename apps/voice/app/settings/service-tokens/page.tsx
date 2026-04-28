import { listServiceTokens } from '@/lib/queries';
import { revokeServiceToken } from '@/lib/actions';
import { formatDateTime } from '@/lib/format';
import { timeAgo } from '@/lib/utils';
import { SettingsTabs } from '../_tabs';
import { IssueTokenForm } from './_issue-form';
import { cn } from '@/lib/utils';

export default async function ServiceTokensPage() {
  const tokens = await listServiceTokens();
  const active = tokens.filter(t => !t.revoked_at);
  const revoked = tokens.filter(t => t.revoked_at);
  const internalConfigured = !!process.env.VOICE_GATEWAY_INTERNAL_TOKEN;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Settings</span>
        <h1 className="font-display text-3xl font-bold tracking-display text-green-deep">
          Service <span className="italic-amber">tokens</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Other Pulse apps authenticate to{' '}
          <code className="font-mono">/api/llm/run</code> with{' '}
          <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>
          . We store only the SHA-256 hash; the unhashed value is shown once at
          issuance.
        </p>
        <SettingsTabs current="service-tokens" />
      </header>

      <div className="rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep">
            Bootstrap token
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow',
              internalConfigured
                ? 'bg-green-mid/20 text-green-deep'
                : 'bg-bad/15 text-bad'
            )}
          >
            {internalConfigured ? 'configured' : 'missing'}
          </span>
          <span className="text-xs text-charcoal/65">
            <code className="font-mono">VOICE_GATEWAY_INTERNAL_TOKEN</code> env
            var works as a backdoor for cross-app calls until a real token is
            issued. Rotate by issuing a real one and removing the env var.
          </span>
        </div>
      </div>

      <IssueTokenForm />

      <section className="flex flex-col gap-3">
        <span className="eyebrow">Active</span>
        {active.length === 0 ? (
          <div className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
            No active tokens issued. The bootstrap env var is the only path
            right now.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
            {active.map(t => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-green-deep">
                    {t.label}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                    <span>
                      hash{' '}
                      <span className="font-mono text-charcoal/65">
                        {t.token_hash.slice(0, 12)}…
                      </span>
                    </span>
                    {t.scopes.map(s => (
                      <span
                        key={s}
                        className="rounded-full bg-cream/50 px-2 py-0.5 font-mono"
                      >
                        {s}
                      </span>
                    ))}
                    <span>· issued {timeAgo(t.created_at)}</span>
                  </div>
                </div>
                <form action={revokeServiceToken}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="btn-ghost text-[11px]">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Revoked</span>
          <ul className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
            {revoked.map(t => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
              >
                <span className="font-semibold text-charcoal/65">
                  {t.label}
                </span>
                <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                  revoked {formatDateTime(t.revoked_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
