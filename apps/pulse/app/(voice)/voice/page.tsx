import Link from 'next/link';
import { ArrowRight, BookOpen, FileCode2, Sparkles } from 'lucide-react';
import {
  getLibraryStats,
  listLatestBriefs,
  listRecentRuns,
  listTemplates,
} from '@/lib/voice/queries';
import {
  formatCents,
  formatDateTime,
  formatTokens,
} from '@/lib/voice/format';
import { timeAgo } from '@/lib/utils';
import { CallingAppChip, StatusChip } from '@/components/voice/calling-app-chip';
import type { PromptTemplate } from '@/lib/voice/types';

export default async function LibraryPage() {
  const [stats, briefs, templates, runs] = await Promise.all([
    getLibraryStats(),
    listLatestBriefs(),
    listTemplates(),
    listRecentRuns(10),
  ]);

  const activeTemplates = templates.filter(t => !t.archived);
  const byApplies = new Map<string, PromptTemplate[]>();
  for (const t of activeTemplates) {
    const key = t.applies_to;
    if (!byApplies.has(key)) byApplies.set(key, []);
    byApplies.get(key)!.push(t);
  }

  return (
    <div className="flex flex-col gap-12">
      <Hero
        templates={stats.templates_count}
        briefs={stats.briefs_count}
        runs7d={stats.runs_7d}
        cost7d={stats.cost_cents_7d}
      />

      <section className="grid gap-8 lg:grid-cols-3">
        <BriefsColumn briefs={briefs} />
        <TemplatesColumn byApplies={byApplies} />
        <RunsColumn runs={runs} />
      </section>
    </div>
  );
}

function Hero({
  templates,
  briefs,
  runs7d,
  cost7d,
}: {
  templates: number;
  briefs: number;
  runs7d: number;
  cost7d: number;
}) {
  return (
    <section className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-10 text-cream shadow-card">
      <span
        aria-hidden
        className="watermark cream pointer-events-none absolute -bottom-6 right-4 text-[160px] leading-none"
      >
        VOICE
      </span>
      <span className="eyebrow cream">The agency LLM gateway</span>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-display tracking-display sm:text-5xl">
        Pulse <span className="italic-amber">voice</span>.
        <span className="mt-1 block text-2xl font-normal text-cream/75 sm:text-3xl">
          One library. One gateway. Every prompt, every brand.
        </span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-cream/70">
        Brand briefs, prompt templates, and the gateway every Pulse tool calls
        when it talks to Claude. Runs and costs land here too — so the whole
        suite stays auditable from one room.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Templates" value={String(templates)} />
        <StatTile label="Brand briefs" value={String(briefs)} accent="amber" />
        <StatTile label="Runs · 7d" value={formatTokens(runs7d)} />
        <StatTile label="Cost · 7d" value={formatCents(cost7d)} accent="amber" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/voice/playground"
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-mid bg-amber-mid px-4 py-2 text-xs font-semibold uppercase tracking-eyebrow text-charcoal hover:bg-amber-deep hover:text-cream-lt"
        >
          <Sparkles size={14} /> Playground
        </Link>
        <Link
          href="/voice/runs"
          className="inline-flex items-center gap-1.5 rounded-md border border-cream/30 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-eyebrow text-cream hover:border-amber-mid/60 hover:text-amber-light"
        >
          See runs feed <ArrowRight size={12} />
        </Link>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-eyebrow text-cream/55">
        {label}
      </div>
      <div
        className={`font-display text-2xl font-bold tabular-nums ${
          accent === 'amber' ? 'italic-amber' : 'text-cream-lt'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BriefsColumn({
  briefs,
}: {
  briefs: Awaited<ReturnType<typeof listLatestBriefs>>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Brand briefs</span>
        <Link
          href="/voice/briefs"
          className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
        >
          All briefs <ArrowRight size={12} className="inline" />
        </Link>
      </div>
      {briefs.length === 0 ? (
        <EmptyCard
          icon={<BookOpen size={20} />}
          title="No briefs yet"
          body="Write the first brand brief to ground every prompt in voice."
          cta={{ href: '/voice/briefs', label: 'Create brief' }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {briefs.slice(0, 6).map(b => (
            <li key={b.id}>
              <Link
                href={
                  b.client_id
                    ? `/voice/briefs/${b.client_id}`
                    : '/voice/briefs'
                }
                className="block rounded-md border border-cream-dk/60 bg-white p-3 shadow-sm transition-all duration-fast hover:-translate-y-0.5 hover:border-amber-mid/60 hover:shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-base font-bold text-green-deep">
                    {b.client_name ?? 'Global voice'}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                    v{b.version}
                  </span>
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-charcoal/65">
                  {b.body_md.trim() || 'No body yet — open to edit.'}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                  Updated {timeAgo(b.updated_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TemplatesColumn({
  byApplies,
}: {
  byApplies: Map<string, PromptTemplate[]>;
}) {
  const groups = Array.from(byApplies.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Templates</span>
        <Link
          href="/voice/templates"
          className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
        >
          All templates <ArrowRight size={12} className="inline" />
        </Link>
      </div>
      {groups.length === 0 ? (
        <EmptyCard
          icon={<FileCode2 size={20} />}
          title="No templates yet"
          body="Seed templates failed to load — check the migration."
          cta={{ href: '/voice/templates/new', label: 'New template' }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([appliesTo, items]) => (
            <div key={appliesTo} className="rounded-md border border-cream-dk/60 bg-white p-3 shadow-sm">
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                {appliesTo}
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map(t => (
                  <li key={t.id}>
                    <Link
                      href={`/voice/templates/${t.slug}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-cream/40"
                    >
                      <span className="truncate font-semibold text-green-deep">
                        {t.name}
                      </span>
                      <span className="font-mono text-[10px] text-charcoal/50">
                        {t.slug}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RunsColumn({
  runs,
}: {
  runs: Awaited<ReturnType<typeof listRecentRuns>>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Recent runs</span>
        <Link
          href="/voice/runs"
          className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
        >
          All runs <ArrowRight size={12} className="inline" />
        </Link>
      </div>
      {runs.length === 0 ? (
        <EmptyCard
          icon={<Sparkles size={20} />}
          title="Quiet on the wire"
          body="No runs yet. Use the playground to send the first one."
          cta={{ href: '/voice/playground', label: 'Open playground' }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map(r => (
            <li key={r.id}>
              <Link
                href={`/voice/runs/${r.id}`}
                className="block rounded-md border border-cream-dk/60 bg-white p-3 shadow-sm transition-all duration-fast hover:-translate-y-0.5 hover:border-amber-mid/60 hover:shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <CallingAppChip app={r.calling_app} size="sm" />
                  <StatusChip status={r.status} />
                </div>
                <div className="mt-1.5 truncate font-display text-sm font-bold text-green-deep">
                  {r.template_name ?? r.prompt_slug ?? 'Custom'}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                  <span className="font-mono">
                    {formatTokens((r.tokens_in ?? 0) + (r.tokens_out ?? 0))} tok
                  </span>
                  <span className="tabular-nums">
                    {formatCents(r.cost_cents)}
                  </span>
                  <span>{formatDateTime(r.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/60 p-6 text-center">
      <span className="mb-2 text-amber-deep">{icon}</span>
      <h3 className="font-display text-lg font-bold text-green-deep">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-charcoal/65">{body}</p>
      <Link href={cta.href} className="btn-primary mt-3">
        {cta.label}
      </Link>
    </div>
  );
}
