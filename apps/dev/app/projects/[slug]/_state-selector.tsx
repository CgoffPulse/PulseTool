'use client';

import { useTransition } from 'react';
import { updateProjectField } from '@/lib/actions';
import {
  PROJECT_STATES,
  PROJECT_STATE_LABEL,
  type Project,
} from '@/lib/types';

export function ProjectStateSelector({ project }: { project: Project }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={project.state}
      disabled={pending}
      onChange={e => start(() => updateProjectField(project.id, { state: e.target.value }))}
      className="rounded-md border border-slate-500/30 bg-ink-mid px-3 py-1.5 text-xs uppercase tracking-eyebrow text-slate-100 focus:border-indigo-soft focus:outline-none disabled:opacity-50"
    >
      {PROJECT_STATES.map(s => (
        <option key={s} value={s}>
          {PROJECT_STATE_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
