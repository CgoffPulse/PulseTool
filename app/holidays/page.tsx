import { listClients, listHolidays } from '@/lib/queries';
import { HolidaysEditor } from './_editor';

export const dynamic = 'force-dynamic';

export default async function HolidaysPage() {
  let holidays: Awaited<ReturnType<typeof listHolidays>> = [];
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let connError: string | null = null;
  try {
    [holidays, clients] = await Promise.all([listHolidays(), listClients()]);
  } catch (err) {
    connError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-cream-dk/60 pb-7">
        <div className="eyebrow">Reference</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          Holidays & <span className="italic text-amber-deep">key dates</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          Dates that matter to any client. Used as planning prompts during the month.
        </p>
      </header>

      {connError ? (
        <div className="rounded-lg border border-amber-deep/30 bg-amber-light/30 px-5 py-4 text-sm text-charcoal">
          {connError}
        </div>
      ) : null}

      <HolidaysEditor initial={holidays} clients={clients} />
    </div>
  );
}
