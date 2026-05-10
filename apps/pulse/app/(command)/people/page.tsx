import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getPeopleRoster } from '@/lib/command/queries';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const roster = await getPeopleRoster();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          People
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
          Workload across the team
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          One row per person — open task count, shoots in the next 14 days, projects assigned. Click
          a name to see their plate for today.
        </p>
      </header>

      {roster.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
          <table className="w-full">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-right">Open tasks</th>
                <th className="px-5 py-3 text-right">Shoots 14d</th>
                <th className="px-5 py-3 text-right">Active projects</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {roster.map(r => (
                <tr
                  key={r.person.id}
                  className="border-b border-stone-100 last:border-0 transition-colors duration-150 hover:bg-stone-50"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/people/${r.person.id}`}
                      className="flex items-center gap-2.5 font-medium text-stone-900 hover:text-amber-deep"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: r.person.color }}
                        aria-hidden
                      />
                      {r.person.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-[13px] capitalize text-stone-600">
                    {r.person.role.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums text-stone-900">
                    {r.open_tasks}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-stone-700">
                    {r.shoots_next_14d}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-stone-700">
                    {r.active_projects}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/people/${r.person.id}`}
                      className="inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-amber-deep"
                    >
                      View plate
                      <ArrowUpRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
      <h3 className="font-display text-lg font-semibold text-stone-900">No team yet</h3>
      <p className="max-w-md text-[14px] leading-[1.55] text-stone-600">
        Add people in <code className="font-mono text-[12px]">public.people</code> and they&rsquo;ll
        roster up here automatically.
      </p>
    </div>
  );
}
