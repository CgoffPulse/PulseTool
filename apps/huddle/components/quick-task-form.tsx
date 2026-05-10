'use client';

import { useRef, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createTask } from '@/lib/command-actions';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  type Person,
  type Project,
} from '@/lib/types';

export function QuickTaskForm({
  project,
  projects,
  people,
  defaultProjectId,
  defaultPersonId,
}: {
  project?: Pick<Project, 'id'> | null;
  projects?: Array<Pick<Project, 'id' | 'name'>>;
  people?: Array<Pick<Person, 'id' | 'name'>>;
  defaultProjectId?: string | null;
  defaultPersonId?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      action={fd =>
        start(async () => {
          await createTask(fd);
          formRef.current?.reset();
        })
      }
      className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-3 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]"
    >
      <input
        name="title"
        required
        placeholder="Add a task…"
        className="min-w-[220px] flex-1 rounded-md border-0 bg-transparent px-2 py-1.5 text-[14px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-0"
      />
      {project ? (
        <input type="hidden" name="project_id" value={project.id} />
      ) : projects && projects.length > 0 ? (
        <select
          name="project_id"
          defaultValue={defaultProjectId ?? ''}
          className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[12px] text-stone-700 focus:border-amber-mid focus:outline-none"
        >
          <option value="">No project</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
      {people && people.length > 0 && (
        <select
          name="assigned_person_id"
          defaultValue={defaultPersonId ?? ''}
          className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[12px] text-stone-700 focus:border-amber-mid focus:outline-none"
        >
          <option value="">Unassigned</option>
          {people.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <select
        name="priority"
        defaultValue="p2"
        className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600 focus:border-amber-mid focus:outline-none"
      >
        {TASK_PRIORITIES.map(p => (
          <option key={p} value={p}>
            {TASK_PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="due_date"
        className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[12px] text-stone-700 focus:border-amber-mid focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3 py-1.5 text-[12px] font-medium text-cream-lt transition-colors hover:bg-green-mid disabled:opacity-50"
      >
        <Plus size={14} />
        Add
      </button>
    </form>
  );
}
