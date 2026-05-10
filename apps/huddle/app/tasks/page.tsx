import Link from 'next/link';
import { TaskRow } from '@/components/task-row';
import { QuickTaskForm } from '@/components/quick-task-form';
import {
  listClients,
  listDepartments,
  listPeople,
  listProjects,
  listTasks,
} from '@/lib/command-queries';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  priority?: string;
  client?: string;
  person?: string;
  department?: string;
  show?: string;
}

const STATUS_SET = new Set<string>(TASK_STATUSES);
const PRIORITY_SET = new Set<string>(TASK_PRIORITIES);

const GROUP_ORDER: TaskStatus[] = ['in_progress', 'next', 'blocked', 'backlog', 'done', 'cancelled'];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status =
    sp.status && STATUS_SET.has(sp.status) ? (sp.status as TaskStatus) : undefined;
  const priority =
    sp.priority && PRIORITY_SET.has(sp.priority) ? (sp.priority as TaskPriority) : undefined;
  const showAll = sp.show === 'all';

  const [tasks, clients, people, departments, projects] = await Promise.all([
    listTasks({
      status,
      priority,
      client_slug: sp.client || undefined,
      assigned_person_id: sp.person || undefined,
      department_id: sp.department || undefined,
      open_only: !showAll && !status,
      limit: 500,
    }),
    listClients(),
    listPeople(),
    listDepartments(),
    listProjects({}),
  ]);

  const grouped: Record<TaskStatus, Task[]> = {
    backlog: [],
    next: [],
    in_progress: [],
    blocked: [],
    done: [],
    cancelled: [],
  };
  for (const t of tasks) grouped[t.status].push(t);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Tasks
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
          What&rsquo;s on the wire
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          The agency&rsquo;s task ledger. Most rows here are auto-created from real signals — what
          posts shifted, what shoots resolved, what AI runs landed. Manual tasks are encouraged but
          rarely necessary.
        </p>
      </header>

      <FilterBar
        sp={sp}
        clients={clients.map(c => ({ slug: c.slug, name: c.name }))}
        people={people.map(p => ({ id: p.id, name: p.name }))}
        departments={departments.map(d => ({ id: d.id, name: d.name }))}
      />

      <QuickTaskForm
        projects={projects.map(p => ({ id: p.id, name: p.name }))}
        people={people.map(p => ({ id: p.id, name: p.name }))}
      />

      {tasks.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex flex-col gap-8">
          {GROUP_ORDER.map(s => {
            const rows = grouped[s];
            if (rows.length === 0) return null;
            return (
              <section key={s} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-stone-600">
                    {TASK_STATUS_LABEL[s]}
                  </h2>
                  <span className="text-[11px] tabular-nums text-stone-400">{rows.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map(t => (
                    <TaskRow key={t.id} task={t} showProject showClient showAssignee />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  sp,
  clients,
  people,
  departments,
}: {
  sp: SearchParams;
  clients: Array<{ slug: string; name: string }>;
  people: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}) {
  return (
    <form
      method="get"
      action="/tasks"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-3"
    >
      <FilterSelect
        name="status"
        defaultValue={sp.status ?? ''}
        placeholder="Open (default)"
        options={TASK_STATUSES.map(s => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
      />
      <FilterSelect
        name="priority"
        defaultValue={sp.priority ?? ''}
        placeholder="Any priority"
        options={TASK_PRIORITIES.map(p => ({ value: p, label: TASK_PRIORITY_LABEL[p] }))}
      />
      <FilterSelect
        name="person"
        defaultValue={sp.person ?? ''}
        placeholder="Anyone"
        options={people.map(p => ({ value: p.id, label: p.name }))}
      />
      <FilterSelect
        name="client"
        defaultValue={sp.client ?? ''}
        placeholder="Any client"
        options={clients.map(c => ({ value: c.slug, label: c.name }))}
      />
      <FilterSelect
        name="department"
        defaultValue={sp.department ?? ''}
        placeholder="Any department"
        options={departments.map(d => ({ value: d.id, label: d.name }))}
      />
      <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-stone-600">
        <input
          type="checkbox"
          name="show"
          value="all"
          defaultChecked={sp.show === 'all'}
          className="rounded border-stone-300"
        />
        Include closed
      </label>
      <button
        type="submit"
        className="rounded-md bg-stone-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-stone-700"
      >
        Apply
      </button>
      <Link
        href="/tasks"
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

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
      <h3 className="font-display text-lg font-semibold text-stone-900">Inbox zero</h3>
      <p className="max-w-md text-[14px] leading-[1.55] text-stone-600">
        Nothing to action. The signal engine will post anything new it detects across the agency.
      </p>
    </div>
  );
}
