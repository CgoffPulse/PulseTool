'use client';

import { useRef, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createTask } from '@/lib/actions';
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, type Project } from '@/lib/types';

export function QuickTaskForm({
  project,
  projects,
  defaultProjectId,
}: {
  project?: Project;
  projects?: Project[];
  defaultProjectId?: string | null;
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
      className="flex flex-wrap items-center gap-2 rounded-md border border-cream-dk/60 bg-white p-2 shadow-sm"
    >
      <input
        name="title"
        required
        placeholder="Add a task… (be specific)"
        className="flex-1 min-w-[220px] rounded-md border-0 bg-transparent px-2 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-0"
      />
      {project ? (
        <input type="hidden" name="project_id" value={project.id} />
      ) : projects ? (
        <select
          name="project_id"
          defaultValue={defaultProjectId ?? ''}
          className="rounded-md border border-cream-dk/60 bg-cream-lt px-2 py-1.5 text-xs text-charcoal/70 focus:border-amber-mid focus:outline-none"
        >
          <option value="">Inbox</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
      <select
        name="priority"
        defaultValue="p2"
        className="rounded-md border border-cream-dk/60 bg-cream-lt px-2 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/70 focus:border-amber-mid focus:outline-none"
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
        className="rounded-md border border-cream-dk/60 bg-cream-lt px-2 py-1.5 text-xs text-charcoal/70 focus:border-amber-mid focus:outline-none"
      />
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        <Plus size={14} />
        Add
      </button>
    </form>
  );
}
