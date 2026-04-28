import Link from 'next/link';
import { listClientsForAnalytics } from '@/lib/social-bridge';
import { listAllAccounts } from '@/lib/queries';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[clients page] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function ClientsPage() {
  const [clients, accounts] = await Promise.all([
    safe(listClientsForAnalytics, [] as Awaited<ReturnType<typeof listClientsForAnalytics>>),
    safe(listAllAccounts, [] as Awaited<ReturnType<typeof listAllAccounts>>),
  ]);

  const countByClient = new Map<string, number>();
  for (const a of accounts) {
    countByClient.set(a.client_id, (countByClient.get(a.client_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-cream-dk/60 pb-4">
        <span className="eyebrow">Clients</span>
        <h1 className="font-display text-4xl font-bold text-green-deep">
          All <span className="italic-amber">clients</span>.
        </h1>
      </header>

      {clients.length === 0 ? (
        <p className="rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center text-sm text-charcoal/55">
          No clients found.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.map(c => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.slug}`}
                className="flex items-center justify-between rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm hover:shadow-card"
              >
                <span>
                  <span className="block font-display text-lg font-bold text-green-deep">
                    {c.name}
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                    {c.slug}
                  </span>
                </span>
                <span className="chip-cream">
                  {countByClient.get(c.id) ?? 0} acct
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
