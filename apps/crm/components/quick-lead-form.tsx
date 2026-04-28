import { Plus } from 'lucide-react';
import { createQuickLead } from '@/lib/actions';
import type { Source } from '@/lib/types';

export function QuickLeadForm({ sources }: { sources: Source[] }) {
  return (
    <form
      action={createQuickLead}
      className="flex flex-col gap-2 rounded-md border border-cream-dk/60 bg-white p-3 shadow-sm sm:flex-row sm:items-center"
    >
      <input
        type="text"
        name="name"
        required
        placeholder="Lead name"
        className="input flex-1 sm:max-w-[220px]"
      />
      <input
        type="text"
        name="company"
        placeholder="Company (optional)"
        className="input flex-1"
      />
      <select name="source_id" className="select sm:max-w-[180px]" defaultValue="">
        <option value="">No source</option>
        {sources.map(s => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-primary shrink-0">
        <Plus size={14} /> Add
      </button>
    </form>
  );
}
