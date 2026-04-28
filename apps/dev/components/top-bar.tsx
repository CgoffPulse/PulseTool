'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckSquare, FolderGit2, Inbox } from 'lucide-react';
import { BrandMark } from './brand-mark';
import { cn } from '@/lib/utils';

export function TopBar() {
  const pathname = usePathname() ?? '/';
  return (
    <header className="sticky top-0 z-30 border-b border-slate-500/20 bg-ink-deep/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark size={28} />
          <span className="leading-tight">
            <span className="block text-lg font-bold tracking-tight text-slate-50">
              Pulse <span className="text-indigo-soft">Dev</span>
            </span>
            <span className="block text-2xs uppercase tracking-eyebrow text-slate-400">
              Project &amp; task hub
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-xs uppercase tracking-eyebrow">
          <NavLink href="/" active={pathname === '/'} icon={<Inbox size={14} />}>
            Today
          </NavLink>
          <NavLink
            href="/projects"
            active={pathname.startsWith('/projects')}
            icon={<FolderGit2 size={14} />}
          >
            Projects
          </NavLink>
          <NavLink
            href="/tasks"
            active={pathname.startsWith('/tasks')}
            icon={<CheckSquare size={14} />}
          >
            Tasks
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors duration-fast',
        active
          ? 'bg-indigo/15 text-indigo-soft'
          : 'text-slate-300 hover:bg-slate-500/10 hover:text-slate-50'
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
