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
      onChange={e =>
        start(() => updateProjectField(project.id, { state: e.target.value }))
      }
      className="rounded-md border border-cream/20 bg-cream/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-cream focus:border-amber-mid focus:outline-none disabled:opacity-50"
    >
      {PROJECT_STATES.map(s => (
        <option key={s} value={s} className="text-charcoal">
          {PROJECT_STATE_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
