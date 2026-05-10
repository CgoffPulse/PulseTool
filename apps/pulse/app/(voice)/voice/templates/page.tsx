import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listTemplates } from '@/lib/voice/queries';
import type { PromptTemplate } from '@/lib/voice/types';

export default async function TemplatesPage() {
  const templates = await listTemplates();
  const active = templates.filter(t => !t.archived);
  const archived = templates.filter(t => t.archived);
  const groups = groupBy(active, t => t.applies_to);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Templates</span>
        <h1 className="font-display text-4xl font-bold tracking-display text-green-deep">
          The <span className="italic-amber">prompt</span> library.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Versioned prompt templates that the gateway resolves by slug. Each
          template knows its system + user shape and a default model.
        </p>
        <div className="mt-3">
          <Link href="/voice/templates/new" className="btn-primary">
            <Plus size={14} /> New template
          </Link>
        </div>
      </header>

      {Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([appliesTo, items]) => (
          <Group key={appliesTo} appliesTo={appliesTo} items={items} />
        ))}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Archived</span>
          <ul className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
            {archived.map(t => (
              <li
                key={t.id}
                className="flex items-center justify-between border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
              >
                <Link
                  href={`/voice/templates/${t.slug}`}
                  className="font-semibold text-charcoal/65 hover:text-amber-deep"
                >
                  {t.name}
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                  {t.slug}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Group({
  appliesTo,
  items,
}: {
  appliesTo: string;
  items: PromptTemplate[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{appliesTo}</span>
        <span className="text-xs uppercase tracking-eyebrow text-charcoal/55">
          {items.length} template{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(t => (
          <Link
            key={t.id}
            href={`/voice/templates/${t.slug}`}
            className="group flex flex-col gap-2 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm transition-all duration-fast hover:-translate-y-0.5 hover:border-amber-mid/60 hover:shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-display text-lg font-bold leading-tight text-green-deep">
                {t.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                v{t.version}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/55">
              {t.slug}
            </span>
            {t.description && (
              <p className="line-clamp-3 text-xs text-charcoal/65">
                {t.description}
              </p>
            )}
            <span className="mt-auto inline-flex w-fit rounded-full bg-cream/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/55">
              {t.default_model}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}
