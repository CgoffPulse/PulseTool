import Link from 'next/link';
import { ProjectCard } from '@/components/project-card';
import { listClients, listDepartments, listProjects } from '@/lib/command/queries';
import {
  WORK_KINDS,
  WORK_KIND_LABEL,
  WORK_STATES,
  WORK_STATE_LABEL,
  type ProjectSummary,
  type WorkKind,
  type WorkState,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  view?: string;
  kind?: string;
  state?: string;
  client?: string;
  department?: string;
}

const KIND_SET = new Set<string>(WORK_KINDS);
const STATE_SET = new Set<string>(WORK_STATES);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view = sp.view === 'kanban' ? 'kanban' : 'list';
  const kindFilter = sp.kind && KIND_SET.has(sp.kind) ? (sp.kind as WorkKind) : undefined;
  const stateFilter = sp.state && STATE_SET.has(sp.state) ? (sp.state as WorkState) : undefined;
  const clientFilter = sp.client || undefined;

  const [projects, clients, departments] = await Promise.all([
    listProjects({
      kind: kindFilter,
      state: stateFilter,
      client_slug: clientFilter,
      department_id: sp.department || undefined,
    }),
    listClients(),
    listDepartments(),
  ]);

  const grouped = groupProjects(projects);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Projects
        </span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            Everything in motion
          </h1>
          <ViewSwitcher current={view} sp={sp} />
        </div>
        <p className="max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          Active client campaigns, internal builds, and onboarding sweeps — grouped by client.
          Filter by kind, state, client, or department to narrow the lens.
        </p>
      </header>

      <FilterBar
        sp={sp}
        clients={clients.map(c => ({ slug: c.slug, name: c.name }))}
        departments={departments.map(d => ({ id: d.id, name: d.name }))}
      />

      {projects.length === 0 ? (
        <Empty />
      ) : view === 'kanban' ? (
        <KanbanView projects={projects} />
      ) : (
        <GroupedList grouped={grouped} />
      )}
    </div>
  );
}

function ViewSwitcher({ current, sp }: { current: string; sp: SearchParams }) {
  const baseQs = qsFromSP(sp, 'view');
  const linkClass =
    'rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150';
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1">
      <Link
        href={`/projects?${baseQs}view=list`}
        className={
          current === 'list'
            ? `${linkClass} border-stone-900 bg-stone-900 text-white`
            : `${linkClass} border-transparent text-stone-600 hover:bg-stone-50`
        }
      >
        List
      </Link>
      <Link
        href={`/projects?${baseQs}view=kanban`}
        className={
          current === 'kanban'
            ? `${linkClass} border-stone-900 bg-stone-900 text-white`
            : `${linkClass} border-transparent text-stone-600 hover:bg-stone-50`
        }
      >
        Kanban
      </Link>
    </div>
  );
}

function FilterBar({
  sp,
  clients,
  departments,
}: {
  sp: SearchParams;
  clients: Array<{ slug: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}) {
  return (
    <form
      action="/projects"
      method="get"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-3"
    >
      <input type="hidden" name="view" value={sp.view ?? 'list'} />
      <FilterSelect
        name="kind"
        defaultValue={sp.kind ?? ''}
        placeholder="All kinds"
        options={WORK_KINDS.map(k => ({ value: k, label: WORK_KIND_LABEL[k] }))}
      />
      <FilterSelect
        name="state"
        defaultValue={sp.state ?? ''}
        placeholder="All states"
        options={WORK_STATES.map(s => ({ value: s, label: WORK_STATE_LABEL[s] }))}
      />
      <FilterSelect
        name="client"
        defaultValue={sp.client ?? ''}
        placeholder="All clients"
        options={clients.map(c => ({ value: c.slug, label: c.name }))}
      />
      <FilterSelect
        name="department"
        defaultValue={sp.department ?? ''}
        placeholder="All departments"
        options={departments.map(d => ({ value: d.id, label: d.name }))}
      />
      <button
        type="submit"
        className="rounded-md bg-stone-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-stone-700"
      >
        Apply
      </button>
      <Link
        href="/projects"
        className="rounded-md border border-stone-200 px-3 py-1.5 text-[12px] text-stone-600 hover:bg-stone-50"
      >
        Reset
      </Link>
    </form>
  );
}

function FilterSelect({
  name,
  defaultValue,
  placeholder,
  options,
}: {
  name: string;
  defaultValue: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[13px] text-stone-700 focus:border-amber-mid focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function groupProjects(projects: ProjectSummary[]) {
  const groups = new Map<string, { label: string; rows: ProjectSummary[] }>();
  const internal: ProjectSummary[] = [];
  for (const p of projects) {
    if (p.kind === 'internal_build' || !p.client_id) {
      internal.push(p);
      continue;
    }
    const key = p.client_slug ?? 'unknown';
    if (!groups.has(key)) {
      groups.set(key, { label: p.client_name ?? 'Unattributed', rows: [] });
    }
    groups.get(key)!.rows.push(p);
  }
  const sortedGroups = [...groups.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([k, v]) => ({ key: k, label: v.label, rows: v.rows }));
  if (internal.length > 0) {
    sortedGroups.push({ key: 'internal', label: 'Internal', rows: internal });
  }
  return sortedGroups;
}

function GroupedList({ grouped }: { grouped: Array<{ key: string; label: string; rows: ProjectSummary[] }> }) {
  return (
    <div className="flex flex-col gap-10">
      {grouped.map(g => (
        <section key={g.key} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
              {g.label}
            </h2>
            <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500 tabular-nums">
              {g.rows.length} project{g.rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {g.rows.map(p => (
              <ProjectCard key={p.id} row={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function KanbanView({ projects }: { projects: ProjectSummary[] }) {
  const columns = WORK_STATES.map(state => ({
    state,
    label: WORK_STATE_LABEL[state],
    rows: projects.filter(p => p.state === state),
  }));
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {columns.map(col => (
        <section
          key={col.state}
          className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3"
        >
          <header className="flex items-baseline justify-between px-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600">
              {col.label}
            </span>
            <span className="text-[11px] tabular-nums text-stone-400">{col.rows.length}</span>
          </header>
          <div className="flex flex-col gap-2">
            {col.rows.length === 0 ? (
              <div className="rounded-md border border-dashed border-stone-200 bg-white px-3 py-6 text-center text-[12px] text-stone-400">
                Empty
              </div>
            ) : (
              col.rows.map(p => (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="rounded-md border border-stone-200 bg-white p-3 text-[13px] transition-colors duration-150 hover:bg-stone-50"
                >
                  <div className="font-medium text-stone-900">{p.name}</div>
                  {p.client_name && (
                    <div className="mt-0.5 text-[11px] text-stone-500">{p.client_name}</div>
                  )}
                  {p.target_ship_date && (
                    <div className="mt-1 text-[11px] tabular-nums text-stone-500">
                      Ship {p.target_ship_date}
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
      <h3 className="font-display text-lg font-semibold text-stone-900">No projects yet</h3>
      <p className="max-w-md text-[14px] leading-[1.55] text-stone-600">
        When CRM leads are promoted to clients or new internal builds spin up, they land here.
      </p>
    </div>
  );
}

function qsFromSP(sp: SearchParams, exclude?: string): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === exclude) continue;
    if (v) u.set(k, v);
  }
  const s = u.toString();
  return s ? `${s}&` : '';
}
