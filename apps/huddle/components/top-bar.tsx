'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  CalendarDays,
  CheckSquare,
  FolderGit2,
  Inbox,
  Menu,
  ShieldCheck,
  Users,
  Building2,
  X,
} from 'lucide-react';
import { BrandMark } from './brand-mark';
import { cn } from '@/lib/utils';

const NAV: Array<{
  href: string;
  label: string;
  icon: React.ReactNode;
  matcher: (p: string) => boolean;
}> = [
  { href: '/', label: 'Today', icon: <Inbox size={14} />, matcher: p => p === '/' },
  {
    href: '/projects',
    label: 'Projects',
    icon: <FolderGit2 size={14} />,
    matcher: p => p.startsWith('/projects'),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: <CheckSquare size={14} />,
    matcher: p => p.startsWith('/tasks'),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: <CalendarDays size={14} />,
    matcher: p => p.startsWith('/calendar'),
  },
  {
    href: '/people',
    label: 'People',
    icon: <Users size={14} />,
    matcher: p => p.startsWith('/people'),
  },
  {
    href: '/clients',
    label: 'Clients',
    icon: <Building2 size={14} />,
    matcher: p => p.startsWith('/clients'),
  },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: <ShieldCheck size={14} />,
    matcher: p => p.startsWith('/approvals'),
  },
];

export function TopBar() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  return (
    <header className="no-print sticky top-0 z-30 grain border-b border-cream/10 bg-green-deep text-cream">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="group flex items-center gap-3">
          <BrandMark size={28} tone="inverse" />
          <span className="leading-tight">
            <span className="block font-display text-xl font-semibold tracking-tight">
              Pulse <span className="italic-amber font-display">Command</span>
            </span>
            <span className="block text-[10px] uppercase tracking-[0.08em] text-cream/65">
              The agency operating engine
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-cream/70 md:flex">
          {NAV.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              active={item.matcher(pathname)}
              icon={item.icon}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen(o => !o)}
          className="rounded-md border border-cream/20 p-2 text-cream md:hidden"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {open && (
        <nav className="grid gap-1 border-t border-cream/10 bg-green-deep px-6 py-4 text-[11px] uppercase tracking-[0.08em] text-cream/70 md:hidden">
          {NAV.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              active={item.matcher(pathname)}
              icon={item.icon}
              onClick={() => setOpen(false)}
              full
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
  onClick,
  full,
}: {
  href: string;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  full?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors duration-150',
        full && 'w-full',
        active ? 'bg-cream/10 text-cream' : 'hover:bg-cream/5 hover:text-cream'
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
