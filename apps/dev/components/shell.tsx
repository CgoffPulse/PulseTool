import { listAllOpenTasks, listProjects } from '@/lib/queries';
import type { Project, Task } from '@/lib/types';
import { TopBar } from './top-bar';
import { CommandPalette } from './command-palette';

export async function Shell({ children }: { children: React.ReactNode }) {
  // Cheap: open tasks only (capped). Powers the ⌘K palette across the app.
  // Wrapped in try/catch so the layout still renders during build / when the
  // DB isn't reachable (e.g. Vercel's prerender step has no secrets in scope).
  let projects: Project[] = [];
  let openTasks: Task[] = [];
  try {
    [projects, openTasks] = await Promise.all([
      listProjects(),
      listAllOpenTasks(),
    ]);
  } catch (err) {
    console.warn(
      '[Shell] DB unreachable; rendering without ⌘K data:',
      (err as Error).message
    );
  }
  const projectsById = new Map(projects.map(p => [p.id, p]));
  const taskItems = openTasks.map(task => ({
    task,
    project_slug: task.project_id
      ? projectsById.get(task.project_id)?.slug ?? null
      : null,
  }));

  return (
    <div className="min-h-screen bg-cream-lt">
      <TopBar />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-20">
        {children}
      </main>
      <footer className="mt-12 border-t border-cream-dk/50 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-charcoal/60 sm:flex-row sm:items-center">
          <span>
            <span className="font-display text-base font-bold text-green-deep">
              Pulse Dev
            </span>{' '}
            &middot; sister tool to{' '}
            <a
              href="https://pulse-tool-mauve.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
            >
              Pulse Social
            </a>
            . Bentonville, AR. Built for ourselves.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-eyebrow">
            <kbd className="rounded border border-cream-dk px-1 py-0.5">⌘K</kbd> to jump
          </span>
        </div>
      </footer>
      <CommandPalette projects={projects} tasks={taskItems} />
    </div>
  );
}
