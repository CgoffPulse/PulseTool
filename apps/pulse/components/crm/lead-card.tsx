import Link from 'next/link';
import { CalendarClock, Edit3, Mail, Phone } from 'lucide-react';
import type { LeadWithMeta } from '@/lib/crm/types';
import { formatDateShort, formatMoney, timeAgo } from '@/lib/crm/format';

export function LeadCard({ lead }: { lead: LeadWithMeta }) {
  const stalled = isStalled(lead);
  return (
    <div className="group relative rounded-md border border-cream-dk/60 bg-white shadow-sm transition-all duration-fast hover:-translate-y-0.5 hover:border-amber-mid/60 hover:shadow-card">
      {/* Quick-edit shortcut — sits in the corner so it's always reachable
          without having to drill into the detail view first. */}
      <Link
        href={`/crm/leads/${lead.id}/edit`}
        title="Edit lead details"
        className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-dk/60 bg-white text-charcoal/55 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:border-amber-deep hover:bg-amber-deep hover:text-cream"
      >
        <Edit3 size={12} />
        <span className="sr-only">Edit lead</span>
      </Link>

      <Link href={`/crm/leads/${lead.id}`} className="block p-3">
        <div className="flex items-start justify-between gap-2 pr-9">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base font-bold leading-tight text-green-deep">
              {lead.name}
            </div>
            {lead.company && (
              <div className="truncate text-xs text-charcoal/60">{lead.company}</div>
            )}
          </div>
          {lead.value_cents !== null && (
            <span className="shrink-0 font-mono text-xs font-semibold text-green-deep tabular-nums">
              {formatMoney(lead.value_cents)}
            </span>
          )}
        </div>

        {(lead.source_label || lead.expected_close_date) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
            {lead.source_label && (
              <span className="rounded-full border border-cream-dk/60 bg-cream/40 px-2 py-0.5">
                {lead.source_label}
              </span>
            )}
            {lead.expected_close_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock size={10} />
                {formatDateShort(lead.expected_close_date)}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-charcoal/55">
          <span>
            {stalled ? (
              <span className="font-semibold uppercase tracking-eyebrow text-bad">
                Stalled · {timeAgo(lead.last_touch_at ?? lead.created_at)}
              </span>
            ) : lead.last_touch_at ? (
              <>Touched {timeAgo(lead.last_touch_at)}</>
            ) : (
              <>New {timeAgo(lead.created_at)}</>
            )}
          </span>
          <span className="flex items-center gap-2">
            {lead.email && <Mail size={10} aria-label={lead.email} />}
            {lead.phone && <Phone size={10} aria-label={lead.phone} />}
          </span>
        </div>

        {lead.next_followup_at && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-amber-deep">
            <CalendarClock size={10} />
            Follow up {formatDateShort(lead.next_followup_at)}
          </div>
        )}
      </Link>
    </div>
  );
}

function isStalled(lead: LeadWithMeta): boolean {
  if (lead.stage === 'won' || lead.stage === 'lost') return false;
  const ref = lead.last_touch_at ?? lead.created_at;
  const ms = Date.now() - new Date(ref).getTime();
  return ms > 7 * 24 * 60 * 60 * 1000;
}
