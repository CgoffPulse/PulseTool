import { listClients, listGlossary } from '@/lib/queries';
import {
  archiveGlossaryEntry,
  createGlossaryEntry,
} from '@/lib/actions';
import { GLOSSARY_KINDS } from '@/lib/types';
import { SettingsTabs } from '../_tabs';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<{ client?: string }>;
}

export default async function GlossaryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = sp.client ?? '';

  const filterValue =
    filter === '' ? undefined : filter === 'global' ? null : filter;

  const [entries, clients] = await Promise.all([
    listGlossary(filterValue),
    listClients(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Settings</span>
        <h1 className="font-display text-3xl font-bold tracking-display text-green-deep">
          <span className="italic-amber">Glossary</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Banned and preferred phrases. The gateway appends these to the brand
          brief block on every call so the voice stays clean.
        </p>
        <SettingsTabs current="glossary" />
      </header>

      <form
        action={createGlossaryEntry}
        className="grid gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        <select name="client_id" className="select" defaultValue="">
          <option value="">Global</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="kind" className="select" defaultValue="banned">
          {GLOSSARY_KINDS.map(k => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="text"
          required
          placeholder="phrase"
          className="input"
        />
        <input
          type="text"
          name="replacement"
          placeholder="replacement (optional)"
          className="input"
        />
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/settings/glossary" active={filter === ''}>
          All
        </FilterLink>
        <FilterLink
          href="/settings/glossary?client=global"
          active={filter === 'global'}
        >
          Global only
        </FilterLink>
        {clients.map(c => (
          <FilterLink
            key={c.id}
            href={`/settings/glossary?client=${c.id}`}
            active={filter === c.id}
          >
            {c.name}
          </FilterLink>
        ))}
      </div>

      <ul className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
        {entries.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-charcoal/55">
            No entries yet.
          </li>
        )}
        {entries.map(e => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow',
                  e.kind === 'banned' && 'bg-bad/15 text-bad',
                  e.kind === 'preferred' && 'bg-green-mid/20 text-green-deep',
                  e.kind === 'term' && 'bg-amber/15 text-amber-deep'
                )}
              >
                {e.kind}
              </span>
              <span className="font-mono text-xs text-charcoal/85">
                &ldquo;{e.text}&rdquo;
              </span>
              {e.replacement && (
                <>
                  <span className="text-charcoal/40">→</span>
                  <span className="font-mono text-xs text-green-deep">
                    &ldquo;{e.replacement}&rdquo;
                  </span>
                </>
              )}
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                {e.client_name ?? 'global'}
              </span>
              {e.note && (
                <span className="text-xs text-charcoal/55">— {e.note}</span>
              )}
            </div>
            <form action={archiveGlossaryEntry}>
              <input type="hidden" name="id" value={e.id} />
              <button type="submit" className="btn-ghost text-[11px]">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs uppercase tracking-eyebrow transition-colors',
        active
          ? 'border-green-deep/40 bg-green-deep text-cream-lt'
          : 'border-cream-dk/50 bg-white text-charcoal/65 hover:border-amber-mid/50 hover:text-amber-deep'
      )}
    >
      {children}
    </a>
  );
}
