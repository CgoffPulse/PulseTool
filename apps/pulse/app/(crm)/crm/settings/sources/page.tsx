import Link from 'next/link';
import { listAllSources } from '@/lib/crm/queries';
import {
  archiveSource,
  createSource,
  unarchiveSource,
} from '@/lib/crm/actions';

export default async function SourcesPage() {
  const sources = await listAllSources();
  const active = sources.filter(s => !s.archived);
  const archived = sources.filter(s => s.archived);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Settings</span>
        <h1 className="font-display text-3xl font-bold tracking-display text-green-deep">
          Lead <span className="italic-amber">sources</span>.
        </h1>
        <p className="text-sm text-charcoal/65">
          Where leads come from. Archive what you&apos;re not using; sources show
          up everywhere a lead is created.
        </p>
        <SettingsTabs current="sources" />
      </header>

      <form
        action={createSource}
        className="flex flex-col gap-2 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <input
          type="text"
          name="label"
          required
          placeholder="New source label"
          className="input flex-1"
        />
        <input
          type="number"
          name="sort_index"
          placeholder="Sort"
          defaultValue={50}
          className="input sm:max-w-[120px]"
        />
        <button type="submit" className="btn-primary">
          Add source
        </button>
      </form>

      <Table title="Active" rows={active} archive />
      {archived.length > 0 && <Table title="Archived" rows={archived} archive={false} />}
    </div>
  );
}

function Table({
  title,
  rows,
  archive,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof listAllSources>>;
  archive: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <span className="eyebrow">{title}</span>
      <ul className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
        {rows.map(r => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-green-deep">{r.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                {r.slug} · sort {r.sort_index}
              </span>
            </div>
            <form action={archive ? archiveSource : unarchiveSource}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" className="btn-ghost text-[11px]">
                {archive ? 'Archive' : 'Restore'}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SettingsTabs({ current }: { current: 'sources' | 'lost-reasons' }) {
  return (
    <div className="mt-3 inline-flex gap-2 text-xs uppercase tracking-eyebrow">
      <Link
        href="/crm/settings/sources"
        className={
          current === 'sources'
            ? 'rounded-md border border-green-deep/30 bg-cream/60 px-3 py-1.5 text-green-deep'
            : 'rounded-md border border-cream-dk/40 bg-white px-3 py-1.5 text-charcoal/60 hover:border-amber-mid/50 hover:text-amber-deep'
        }
      >
        Sources
      </Link>
      <Link
        href="/crm/settings/lost-reasons"
        className={
          current === 'lost-reasons'
            ? 'rounded-md border border-green-deep/30 bg-cream/60 px-3 py-1.5 text-green-deep'
            : 'rounded-md border border-cream-dk/40 bg-white px-3 py-1.5 text-charcoal/60 hover:border-amber-mid/50 hover:text-amber-deep'
        }
      >
        Lost reasons
      </Link>
    </div>
  );
}
