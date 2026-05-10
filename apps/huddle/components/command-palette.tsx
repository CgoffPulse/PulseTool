'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  CheckSquare,
  FolderGit2,
  Inbox,
  Search,
  ShieldCheck,
  Users,
  UserSquare2,
} from 'lucide-react';
import type { Client, Person, ProjectSummary, Task } from '@/lib/types';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: 'route' | 'project' | 'task' | 'person' | 'client';
  icon: React.ReactNode;
}

const ROUTES: PaletteItem[] = [
  { id: 'r-today', label: 'Today', href: '/', group: 'route', icon: <Inbox size={14} /> },
  { id: 'r-projects', label: 'Projects', href: '/projects', group: 'route', icon: <FolderGit2 size={14} /> },
  { id: 'r-tasks', label: 'Tasks', href: '/tasks', group: 'route', icon: <CheckSquare size={14} /> },
  { id: 'r-calendar', label: 'Calendar', href: '/calendar', group: 'route', icon: <CalendarDays size={14} /> },
  { id: 'r-people', label: 'People', href: '/people', group: 'route', icon: <Users size={14} /> },
  { id: 'r-approvals', label: 'Approvals', href: '/approvals', group: 'route', icon: <ShieldCheck size={14} /> },
];

export function CommandPalette({
  projects,
  tasks,
  people,
  clients,
}: {
  projects: ProjectSummary[];
  tasks: Task[];
  people: Person[];
  clients: Client[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: PaletteItem[] = useMemo(() => {
    const projItems: PaletteItem[] = projects.map(p => ({
      id: `p-${p.id}`,
      label: p.name,
      hint: p.client_name ?? p.kind,
      href: `/projects/${p.slug}`,
      group: 'project',
      icon: <FolderGit2 size={14} />,
    }));
    const taskItems: PaletteItem[] = tasks.slice(0, 50).map(t => ({
      id: `t-${t.id}`,
      label: t.title,
      hint: t.project_slug ? `→ ${t.project_name ?? t.project_slug}` : 'Inbox',
      href: t.project_slug ? `/projects/${t.project_slug}` : '/tasks',
      group: 'task',
      icon: <CheckSquare size={14} />,
    }));
    const personItems: PaletteItem[] = people.map(p => ({
      id: `pe-${p.id}`,
      label: p.name,
      hint: p.role,
      href: `/people/${p.id}`,
      group: 'person',
      icon: <UserSquare2 size={14} />,
    }));
    const clientItems: PaletteItem[] = clients.map(c => ({
      id: `c-${c.id}`,
      label: c.name,
      hint: c.tier ?? undefined,
      href: `/clients/${c.slug}`,
      group: 'client',
      icon: <Users size={14} />,
    }));
    return [...ROUTES, ...projItems, ...personItems, ...clientItems, ...taskItems];
  }, [projects, tasks, people, clients]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 24);
    const q = query.toLowerCase();
    return items
      .filter(
        i => i.label.toLowerCase().includes(q) || (i.hint?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 24);
  }, [items, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function commit(item: PaletteItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const item = filtered[highlight];
      if (item) commit(item);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-charcoal/40 px-4 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
          <Search size={16} className="text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Jump to a project, task, person, or client…"
            className="flex-1 bg-transparent text-[14px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <kbd className="rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-400">
            esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-stone-400">
              No matches.
            </div>
          ) : (
            <ul>
              {filtered.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => commit(item)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13px] ${
                      i === highlight
                        ? 'bg-stone-100 text-stone-900'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="text-stone-400">{item.icon}</span>
                      <span className="truncate font-medium text-stone-900">{item.label}</span>
                      {item.hint && (
                        <span className="truncate text-[12px] text-stone-400">{item.hint}</span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-stone-400">
                      {item.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-[10px] uppercase tracking-[0.08em] text-stone-500">
          <span>
            <kbd className="rounded border border-stone-200 px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>{' '}
            move{' '}
            <kbd className="ml-2 rounded border border-stone-200 px-1 py-0.5 font-mono text-[9px]">⏎</kbd>{' '}
            open
          </span>
          <span>
            <kbd className="rounded border border-stone-200 px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>{' '}
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
        window.dispatchEvent(ev);
      }}
      className="hidden items-center gap-2 rounded-md border border-cream/15 bg-cream/5 px-3 py-1.5 text-[11px] text-cream/70 hover:bg-cream/10 hover:text-cream md:inline-flex"
      aria-label="Open command palette"
    >
      <Search size={12} />
      <span>Search</span>
      <kbd className="rounded border border-cream/15 px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}
