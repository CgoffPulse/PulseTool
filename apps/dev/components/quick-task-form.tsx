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
      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-500/20 bg-ink-mid/40 p-2"
    >
      <input
        name="title"
        required
        placeholder="Add a task…"
        className="input flex-1 min-w-[240px] border-0 bg-transparent focus:ring-0"
      />
      {project ? (
        <input type="hidden" name="project_id" value={project.id} />
      ) : projects ? (
        <select
          name="project_id"
          defaultValue={defaultProjectId ?? ''}
          className="rounded border border-slate-500/20 bg-ink-mid px-2 py-1 text-xs text-slate-300 focus:border-indigo-soft focus:outline-none"
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
        className="rounded border border-slate-500/20 bg-ink-mid px-2 py-1 text-2xs uppercase tracking-eyebrow text-slate-300 focus:border-indigo-soft focus:outline-none"
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
        className="rounded border border-slate-500/20 bg-ink-mid px-2 py-1 text-xs text-slate-300 focus:border-indigo-soft focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-50"
      >
        <Plus size={14} />
        Add
      </button>
    </form>
  );
}
