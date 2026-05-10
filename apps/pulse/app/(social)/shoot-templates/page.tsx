import { listShootTemplates } from '@/lib/social/queries';
import { ShootTemplatesEditor } from './_editor';

export const dynamic = 'force-dynamic';

export default async function ShootTemplatesPage() {
  let templates: Awaited<ReturnType<typeof listShootTemplates>> = [];
  let connError: string | null = null;
  try {
    templates = await listShootTemplates();
  } catch (err) {
    connError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-cream-dk/60 pb-7">
        <div className="eyebrow">Reference</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          Shoot <span className="italic text-amber-deep">templates</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          Standard capture per shoot type. The capacity numbers below tell the production
          plan how many of each content type a shoot can produce.
        </p>
      </header>

      {connError ? (
        <div className="rounded-lg border border-amber-deep/30 bg-amber-light/30 px-5 py-4 text-sm text-charcoal">
          {connError}
        </div>
      ) : null}

      <ShootTemplatesEditor initial={templates} />
    </div>
  );
}
