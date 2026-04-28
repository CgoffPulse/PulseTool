import { listClientsForAnalytics } from '@/lib/social-bridge';
import { ImportForm } from './_import-form';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[import page] query failed:', (err as Error).message);
    return fallback;
  }
}

export default async function ImportPage() {
  const clients = await safe(
    listClientsForAnalytics,
    [] as Awaited<ReturnType<typeof listClientsForAnalytics>>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-cream-dk/60 pb-4">
        <span className="eyebrow">Import</span>
        <h1 className="font-display text-4xl font-bold text-green-deep">
          Paste a <span className="italic-amber">CSV</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Drop in an Instagram or Facebook account export. We'll detect the format from the
          header row and upsert into{' '}
          <span className="font-mono text-[12px]">analytics.account_metrics_daily</span>.
        </p>
      </header>

      <section className="panel p-6">
        <ImportForm clients={clients} />
      </section>
    </div>
  );
}
