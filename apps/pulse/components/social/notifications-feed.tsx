'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { CheckCheck, Filter, RefreshCw, X } from 'lucide-react';
import {
  dismissAllNotifications,
  dismissNotification,
  regenerateNotifications,
} from '@/lib/social/actions';
import {
  NOTIFICATION_KIND_LABEL,
  type Client,
  type NotificationKind,
  type NotificationRow,
  type Person,
} from '@/lib/social/types';
import { cn } from '@/lib/social/utils';
import { usePerson } from './person-context';

type SeverityFilter = 'all' | 'bad' | 'warn' | 'info';
type StateFilter = 'open' | 'all';

export function NotificationsFeed({
  notifications,
  clients,
  people,
}: {
  notifications: NotificationRow[];
  clients: Client[];
  people: Person[];
}) {
  const router = useRouter();
  const { active } = usePerson();
  const [, start] = useTransition();
  const [audience, setAudience] = useState<'mine' | 'everyone'>(active ? 'mine' : 'everyone');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [clientId, setClientId] = useState<string>('all');
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null);

  const clientById = new Map(clients.map(c => [c.id, c]));

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (stateFilter === 'open' && (n.dismissed_at || n.resolved_at)) return false;
      if (severity !== 'all' && n.severity !== severity) return false;
      if (clientId !== 'all' && n.related_client_id !== clientId) return false;
      if (audience === 'mine' && active) {
        const matches =
          (n.audience_person_id == null && n.audience_role == null) ||
          n.audience_person_id === active.id ||
          n.audience_role === active.role;
        if (!matches) return false;
      }
      return true;
    });
  }, [notifications, severity, clientId, audience, active, stateFilter]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, NotificationRow[]>();
    for (const n of filtered) {
      const day = n.created_at.slice(0, 10);
      const arr = buckets.get(day) ?? [];
      arr.push(n);
      buckets.set(day, arr);
    }
    return Array.from(buckets.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const onDismiss = (id: string) =>
    start(async () => {
      await dismissNotification(id);
      router.refresh();
    });

  const onDismissAll = () =>
    start(async () => {
      await dismissAllNotifications();
      router.refresh();
    });

  const onRecompute = async () => {
    setRecomputing(true);
    setRecomputeMsg(null);
    try {
      const r = await regenerateNotifications();
      setRecomputeMsg(
        `Refreshed. ${r.upserted} active · ${r.resolved} cleared.`
      );
      router.refresh();
    } catch (e) {
      setRecomputeMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setRecomputing(false);
      setTimeout(() => setRecomputeMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-cream-dk/60 pb-6">
        <div className="eyebrow">Production hub</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          What needs <span className="italic text-amber-deep">attention</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          Every alert the action engine raised. Filter by audience, severity, or client.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterToggle
            label="Audience"
            value={audience}
            options={[
              { key: 'mine', label: active ? `Mine (${active.name})` : 'Mine' },
              { key: 'everyone', label: 'Everyone' },
            ]}
            onChange={v => setAudience(v as 'mine' | 'everyone')}
            disabled={!active && audience === 'everyone'}
          />
          <FilterToggle
            label="State"
            value={stateFilter}
            options={[
              { key: 'open', label: 'Open' },
              { key: 'all', label: 'All' },
            ]}
            onChange={v => setStateFilter(v as StateFilter)}
          />
          <FilterToggle
            label="Severity"
            value={severity}
            options={[
              { key: 'all', label: 'All' },
              { key: 'bad', label: 'Priority' },
              { key: 'warn', label: 'Watch' },
              { key: 'info', label: 'Info' },
            ]}
            onChange={v => setSeverity(v as SeverityFilter)}
          />
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="rounded-md border border-cream-dk bg-white px-3 py-1.5 text-sm focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25"
          >
            <option value="all">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {recomputeMsg ? (
            <span className="text-[11px] italic text-charcoal/65">{recomputeMsg}</span>
          ) : null}
          <button
            type="button"
            onClick={onRecompute}
            disabled={recomputing}
            className="inline-flex items-center gap-1.5 rounded-md border border-cream-dk bg-white px-3 py-1.5 text-xs uppercase tracking-label text-charcoal hover:border-amber-mid hover:text-amber-deep disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              className={recomputing ? 'animate-spin' : undefined}
            />
            {recomputing ? 'Refreshing…' : 'Recompute now'}
          </button>
          <button
            type="button"
            onClick={onDismissAll}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3 py-1.5 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
          >
            <CheckCheck size={13} />
            Dismiss all
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-green-deep/25 bg-cream-lt p-16 text-center">
          <p className="font-display text-2xl italic text-green-deep">
            Nothing to show with these filters.
          </p>
          <p className="mt-2 text-sm text-charcoal/55">
            Try widening the filters, or hit "Recompute now" to re-run the engine.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(([day, rows]) => (
            <div key={day}>
              <div className="sticky top-[68px] z-10 -mx-4 mb-3 bg-cream-lt/80 px-4 py-1.5 backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                  {format(parseISO(day), 'EEEE, MMMM d')}
                </div>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card divide-y divide-cream-dk/40">
                {rows.map(n => (
                  <NotifRow
                    key={n.id}
                    n={n}
                    clientById={clientById}
                    onDismiss={() => onDismiss(n.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotifRow({
  n,
  clientById,
  onDismiss,
}: {
  n: NotificationRow;
  clientById: Map<string, Client>;
  onDismiss: () => void;
}) {
  const sevTone =
    n.severity === 'bad'
      ? 'bg-bad/10 ring-bad/30 text-bad'
      : n.severity === 'warn'
      ? 'bg-amber-mid/15 ring-amber-mid/40 text-amber-deep'
      : 'bg-green-light/15 ring-green-light/40 text-green-deep';
  const isOpen = !n.dismissed_at && !n.resolved_at;
  const c = n.related_client_id ? clientById.get(n.related_client_id) : null;
  return (
    <li
      className={cn(
        'flex items-start gap-3 px-5 py-4 transition-colors duration-fast',
        !isOpen && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label ring-1 ring-inset',
          sevTone
        )}
      >
        {n.severity === 'bad' ? 'Priority' : n.severity === 'warn' ? 'Watch' : 'Info'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
          <span>{NOTIFICATION_KIND_LABEL[n.kind as NotificationKind] ?? n.kind}</span>
          {c ? (
            <>
              <span aria-hidden className="text-cream-dk">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </span>
            </>
          ) : null}
          <span aria-hidden className="text-cream-dk">·</span>
          <span className="font-mono">
            {format(parseISO(n.created_at), 'h:mm a')}
          </span>
          {n.dismissed_at ? (
            <span className="rounded-sm bg-cream-dk/40 px-1.5 py-0.5 text-charcoal/55">
              Dismissed
            </span>
          ) : null}
          {n.resolved_at ? (
            <span className="rounded-sm bg-green-light/30 px-1.5 py-0.5 text-green-deep">
              Resolved
            </span>
          ) : null}
        </div>
        <div className="mt-1 font-display text-base font-bold text-green-deep">
          {n.title}
        </div>
        {n.detail ? (
          <div className="mt-0.5 text-sm leading-snug text-charcoal/70">
            {n.detail}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {n.link_url ? (
          <Link
            href={n.link_url}
            className="rounded-md bg-green-deep px-2.5 py-1.5 text-[11px] uppercase tracking-label text-cream hover:bg-charcoal"
          >
            Open
          </Link>
        ) : null}
        {isOpen ? (
          <button
            type="button"
            onClick={onDismiss}
            className="grid h-7 w-7 place-items-center rounded-md text-charcoal/45 hover:bg-cream-lt hover:text-charcoal"
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function FilterToggle({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[10px] uppercase tracking-eyebrow text-charcoal/55 md:inline-flex md:items-center md:gap-1">
        <Filter size={11} />
        {label}
      </span>
      <div className="flex rounded-md border border-cream-dk bg-cream-lt p-0.5 text-[11px] uppercase tracking-label">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            disabled={disabled}
            className={cn(
              'rounded px-2.5 py-1 transition-colors duration-fast',
              value === o.key
                ? 'bg-green-deep text-cream'
                : 'text-charcoal/55 hover:text-charcoal',
              disabled && 'opacity-40'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
