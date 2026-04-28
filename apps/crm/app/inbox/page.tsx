import { Sparkles } from 'lucide-react';
import { listFollowupsDueToday, listStalledLeads } from '@/lib/queries';
import { LeadCard } from '@/components/lead-card';

export default async function InboxPage() {
  const [followups, stalled] = await Promise.all([
    listFollowupsDueToday(),
    listStalledLeads(7),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Inbox</span>
        <h1 className="font-display text-4xl font-bold tracking-display text-green-deep">
          Today&apos;s <span className="italic-amber">follow-ups</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Leads that asked for a nudge today, plus everyone who&apos;s gone
          quiet for more than a week. Touch them or move them off the board.
        </p>
      </header>

      <Section
        eyebrow="Due today"
        emptyLabel="Inbox zero — no scheduled follow-ups."
        leads={followups}
      />
      <Section
        eyebrow="Stalled · no touch in 7+ days"
        emptyLabel="No stalled leads. Quiet on the wire."
        leads={stalled}
      />
    </div>
  );
}

function Section({
  eyebrow,
  emptyLabel,
  leads,
}: {
  eyebrow: string;
  emptyLabel: string;
  leads: Awaited<ReturnType<typeof listFollowupsDueToday>>;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{eyebrow}</span>
        <span className="text-xs uppercase tracking-eyebrow text-charcoal/55">
          {leads.length}
        </span>
      </div>
      {leads.length === 0 ? (
        <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/60 p-8 text-center">
          <Sparkles size={20} className="mb-2 text-amber-deep" />
          <p className="text-sm text-charcoal/65">{emptyLabel}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map(l => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
      )}
    </section>
  );
}
