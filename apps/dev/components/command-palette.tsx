'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  FolderGit2,
  Inbox,
  Plus,
  Search,
  Telescope,
} from 'lucide-react';
import type { Project, Task } from '@/lib/types';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: 'route' | 'project' | 'task';
  icon: React.ReactNode;
}

const ROUTES: PaletteItem[] = [
  {
    id: 'r-today',
    label: 'Today',
    href: '/',
    group: 'route',
    icon: <Inbox size={14} />,
  },
  {
    id: 'r-projects',
    label: 'All projects',
    href: '/projects',
    group: 'route',
    icon: <FolderGit2 size={14} />,
  },
  {
    id: 'r-tasks',
    label: 'All tasks',
    href: '/tasks',
    group: 'route',
    icon: <CheckSquare size={14} />,
  },
  {
    id: 'r-discover',
    label: 'Discover projects',
    href: '/projects/discover',
    group: 'route',
    icon: <Telescope size={14} />,
  },
  {
    id: 'r-new',
    label: 'New project',
    href: '/projects/new',
    group: 'route',
    icon: <Plus size={14} />,
  },
];

export function CommandPalette({
  projects,
  tasks,
}: {
  projects: Project[];
  tasks: Array<{ task: Task; project_slug: string | null }>;
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
      hint: p.current_focus ?? undefined,
      href: `/projects/${p.slug}`,
      group: 'project',
      icon: <FolderGit2 size={14} />,
    }));
    const taskItems: PaletteItem[] = tasks.slice(0, 50).map(({ task, project_slug }) => ({
      id: `t-${task.id}`,
      label: task.title,
      hint: project_slug ? `→ ${project_slug}` : 'Inbox',
      href: project_slug ? `/projects/${project_slug}` : '/tasks',
      group: 'task',
      icon: <CheckSquare size={14} />,
    }));
    return [...ROUTES, ...projItems, ...taskItems];
  }, [projects, tasks]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 24);
    const q = query.toLowerCase();
    return items
      .filter(
        i =>
          i.label.toLowerCase().includes(q) ||
          (i.hint?.toLowerCase().includes(q) ?? false)
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
        className="w-full max-w-xl overflow-hidden rounded-xl border border-cream-dk bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-cream-dk/50 px-4 py-3">
          <Search size={16} className="text-charcoal/45" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Jump to a project, task, or page…"
            className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none"
          />
          <kbd className="rounded border border-cream-dk px-1.5 py-0.5 font-mono text-[10px] text-charcoal/45">
            esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-charcoal/45">
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
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                      i === highlight
                        ? 'bg-amber-mid/15 text-charcoal'
                        : 'hover:bg-cream/60'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="text-amber-deep">{item.icon}</span>
                      <span className="truncate font-medium">{item.label}</span>
                      {item.hint && (
                        <span className="truncate text-xs text-charcoal/45">
                          {item.hint}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/35">
                      {item.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-cream-dk/50 bg-cream-lt px-4 py-2 text-[10px] uppercase tracking-eyebrow text-charcoal/45">
          <span>
            <kbd className="rounded border border-cream-dk px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>{' '}
            move{' '}
            <kbd className="ml-2 rounded border border-cream-dk px-1 py-0.5 font-mono text-[9px]">⏎</kbd>{' '}
            open
          </span>
          <span>
            <kbd className="rounded border border-cream-dk px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>{' '}
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
        const ev = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        });
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
