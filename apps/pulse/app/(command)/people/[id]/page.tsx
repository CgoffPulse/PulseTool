import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Camera } from 'lucide-react';
import { TaskRow } from '@/components/task-row';
import { getPersonPlate, listProjects, listTasks } from '@/lib/command/queries';

export const dynamic = 'force-dynamic';

export default async function PersonPlatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plate = await getPersonPlate(id);
  if (!plate) notFound();

  const [allTasks, projects] = await Promise.all([
    listTasks({ assigned_person_id: id, open_only: true, limit: 200 }),
    listProjects({}),
  ]);
  const myProjects = projects.filter(p => p.assigned_person_id === id);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/people"
          className="self-start text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          ← All people
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              {today}
            </span>
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: plate.person.color }}
                aria-hidden
              />
              <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-900">
                {plate.person.name}
              </h1>
            </div>
            <span className="text-[13px] capitalize text-stone-600">
              {plate.person.role.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open tasks" value={String(plate.open_task_count)} />
        <Stat label="In progress" value={String(plate.in_progress_count)} />
        <Stat label="Blocked" value={String(plate.blocked_count)} />
        <Stat label="Shoots 14d" value={String(plate.shoots_next_14d)} />
      </section>

      {plate.shoots_today.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
            Today&rsquo;s shoots
          </h2>
          <div className="flex flex-col gap-2">
            {plate.shoots_today.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]"
              >
                <span className="flex items-center gap-2.5 text-[14px] text-stone-900">
                  <Camera size={14} className="text-stone-400" />
                  {s.client_name && <span className="font-medium">{s.client_name}</span>}
                  {s.location && <span className="text-stone-600">· {s.location}</span>}
                </span>
                {s.scheduled_time && (
                  <span className="font-mono text-[12px] tabular-nums text-stone-500">
                    {s.scheduled_time}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
          Today&rsquo;s tasks
        </h2>
        {allTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-12 text-center text-[14px] text-stone-600">
            No open tasks. Quiet day.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {allTasks.slice(0, 15).map(t => (
              <TaskRow key={t.id} task={t} showProject showClient />
            ))}
          </div>
        )}
      </section>

      {myProjects.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
            Active projects
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {myProjects.map(p => (
              <Link
                key={p.id}
                href={`/projects/${p.slug}`}
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:bg-stone-50"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                  {p.client_name ?? 'Internal'}
                </div>
                <div className="mt-1 font-display text-lg font-semibold tracking-tight text-stone-900">
                  {p.name}
                </div>
                {p.target_ship_date && (
                  <div className="mt-1.5 text-[12px] tabular-nums text-stone-500">
                    Ship {p.target_ship_date}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums text-stone-900">
        {value}
      </div>
    </div>
  );
}
