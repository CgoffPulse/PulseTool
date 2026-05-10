import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { TaskRow } from '@/components/task-row';
import { WorkKindChip } from '@/components/state-chip';
import {
  getAgencyObjectives,
  getApprovalsQueue,
  getPeopleRoster,
  getPersonPlate,
  getRecentShipments,
} from '@/lib/command-queries';
import type { PersonPlate } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CommandHomePage() {
  const [approvals, objectives, roster, shipments] = await Promise.all([
    getApprovalsQueue(),
    getAgencyObjectives(),
    getPeopleRoster(),
    getRecentShipments(),
  ]);

  // Hydrate plates for each person (parallel).
  const plates: PersonPlate[] = (
    await Promise.all(roster.slice(0, 10).map(r => getPersonPlate(r.person.id)))
  ).filter((p): p is PersonPlate => p !== null);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const oldestApproval = approvals[0] ?? null;

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-6 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
            {today}
          </span>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-stone-900">
            Pulse Command
          </h1>
          <p className="max-w-2xl text-[15px] leading-[1.55] text-stone-600">
            One screen for the agency. Decide where your time goes today, then let the system run
            the rest.
          </p>
        </div>
        <ApprovalsStrip
          count={approvals.length}
          oldest={oldestApproval}
        />
      </header>

      <ObjectivesSection objectives={objectives} />

      <PlatesSection plates={plates} />

      <ShipmentsSection shipments={shipments} />
    </div>
  );
}

// ─── Approvals strip (Christian's queue) ───────────────────────────────────

function ApprovalsStrip({
  count,
  oldest,
}: {
  count: number;
  oldest: { id: string; artifact_kind: string; artifact_title: string | null; client_name?: string | null; waiting_hours: number } | null;
}) {
  return (
    <Link
      href="/approvals"
      className="group flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          <ShieldCheck size={12} />
          Awaiting your sign-off
        </span>
        <ArrowUpRight
          size={14}
          className="text-stone-300 transition-colors group-hover:text-stone-500"
        />
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-semibold tabular-nums text-stone-900">
          {count}
        </span>
        <span className="text-[13px] text-stone-600">
          {count === 1 ? 'approval' : 'approvals'} pending
        </span>
      </div>
      {oldest ? (
        <div className="border-t border-stone-100 pt-3 text-[12px] text-stone-600">
          <span className="text-stone-500">Oldest · </span>
          <span className="font-medium text-stone-800">
            {oldest.artifact_title ?? oldest.artifact_kind}
          </span>
          {oldest.client_name && (
            <>
              <span className="text-stone-400"> · </span>
              {oldest.client_name}
            </>
          )}
          <span className="ml-1 tabular-nums text-stone-500">
            ({oldest.waiting_hours < 24 ? `${oldest.waiting_hours}h` : `${Math.floor(oldest.waiting_hours / 24)}d`})
          </span>
        </div>
      ) : (
        <div className="border-t border-stone-100 pt-3 text-[12px] text-stone-500">
          Inbox zero. The team can ship.
        </div>
      )}
    </Link>
  );
}

// ─── Objectives strip ──────────────────────────────────────────────────────

function ObjectivesSection({
  objectives,
}: {
  objectives: Awaited<ReturnType<typeof getAgencyObjectives>>;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
          Agency objectives
        </h2>
        <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
          Shipping in the next 30 days
        </span>
      </div>
      {objectives.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-10 text-center text-[14px] text-stone-600">
          No projects with ship dates in the next 30 days. Set
          <Link href="/projects" className="ml-1 text-amber-deep hover:underline">
            target ship dates
          </Link>{' '}
          to see what&rsquo;s on the roadmap.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {objectives.map(o => (
            <Link
              key={o.project.id}
              href={`/projects/${o.project.slug}`}
              className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50"
            >
              <WorkKindChip kind={o.project.kind} />
              <div className="font-display text-[17px] font-semibold tracking-tight text-stone-900">
                {o.project.name}
              </div>
              {o.project.client_name && o.project.kind !== 'internal_build' && (
                <div className="text-[12px] text-stone-500">{o.project.client_name}</div>
              )}
              <div className="mt-auto flex items-center gap-2 border-t border-stone-100 pt-3 text-[12px] tabular-nums text-stone-600">
                <CalendarClock size={12} className="text-stone-400" />
                {o.project.target_ship_date}
                {o.days_until_ship !== null && (
                  <span
                    className={
                      o.days_until_ship < 7
                        ? 'ml-auto text-amber-deep'
                        : 'ml-auto text-stone-500'
                    }
                  >
                    {o.days_until_ship < 0 ? `${-o.days_until_ship}d late` : `in ${o.days_until_ship}d`}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Today's plates per person ─────────────────────────────────────────────

function PlatesSection({ plates }: { plates: PersonPlate[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
          Today&rsquo;s plates
        </h2>
        <Link
          href="/people"
          className="text-[12px] uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          All people
        </Link>
      </div>
      {plates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-10 text-center text-[14px] text-stone-600">
          Add people in <code className="font-mono text-[12px]">public.people</code> to see plates here.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plates.map(p => (
            <PlateCard key={p.person.id} plate={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlateCard({ plate }: { plate: PersonPlate }) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <header className="flex items-center justify-between gap-3">
        <Link
          href={`/people/${plate.person.id}`}
          className="flex items-center gap-2.5 text-stone-900 hover:text-amber-deep"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: plate.person.color }}
            aria-hidden
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            {plate.person.name}
          </span>
          <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
            {plate.person.role.replace(/_/g, ' ')}
          </span>
        </Link>
        <ArrowUpRight size={14} className="text-stone-300" />
      </header>

      <div className="grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-center">
        <Mini label="Open" value={plate.open_task_count} />
        <Mini label="Active" value={plate.in_progress_count} />
        <Mini label="Shoots 14d" value={plate.shoots_next_14d} />
      </div>

      {plate.shoots_today.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-stone-100 pt-3 text-[12px] text-stone-700">
          {plate.shoots_today.slice(0, 2).map(s => (
            <div key={s.id} className="flex items-center gap-2">
              <Camera size={12} className="text-stone-400" />
              <span className="truncate">
                {s.client_name && <span className="font-medium">{s.client_name}</span>}
                {s.location && <span className="text-stone-500"> · {s.location}</span>}
              </span>
              {s.scheduled_time && (
                <span className="ml-auto font-mono text-[11px] tabular-nums text-stone-500">
                  {s.scheduled_time}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {plate.top_tasks.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-stone-100 pt-3">
          {plate.top_tasks.map(t => (
            <TaskRow key={t.id} task={t} showProject showClient />
          ))}
        </div>
      ) : (
        <div className="border-t border-stone-100 pt-3 text-[12px] text-stone-500">
          No open tasks. Quiet plate.
        </div>
      )}
    </article>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-stone-500">{label}</div>
    </div>
  );
}

// ─── Shipments today/yesterday ─────────────────────────────────────────────

function ShipmentsSection({
  shipments,
}: {
  shipments: Awaited<ReturnType<typeof getRecentShipments>>;
}) {
  if (shipments.length === 0) return null;
  const total = shipments.reduce((sum, s) => sum + s.count, 0);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        <CheckCircle2 size={12} />
        Shipped in the last 36 hours
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-3xl font-semibold tabular-nums text-stone-900">
          {total}
        </span>
        <span className="text-[13px] text-stone-600">artifacts moved</span>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-stone-700">
        {shipments.map(s => (
          <li key={s.source} className="flex items-center gap-1.5">
            <span className="tabular-nums">{s.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
