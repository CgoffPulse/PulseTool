'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Code2,
  FolderGit2,
  Inbox,
  LayoutGrid,
  Megaphone,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { BrandMark } from './brand-mark';
import { cn } from '@/lib/utils';

const PRIMARY_NAV: Array<{
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

type SecondarySection = {
  key: string;
  label: string;
  blurb: string;
  icon: React.ReactNode;
  rootMatcher: (p: string) => boolean;
  items: Array<{ href: string; label: string }>;
};

const SECONDARY: SecondarySection[] = [
  {
    key: 'studios',
    label: 'Studios',
    blurb: 'Content delivery',
    icon: <Megaphone size={14} />,
    rootMatcher: p =>
      p.startsWith('/workbench') ||
      p.startsWith('/notifications') ||
      p.startsWith('/holidays') ||
      p.startsWith('/shoot-templates') ||
      p.startsWith('/admin'),
    items: [
      { href: '/workbench', label: 'Content workbench' },
      { href: '/notifications', label: 'Notifications' },
      { href: '/holidays', label: 'Holidays' },
      { href: '/shoot-templates', label: 'Shoot templates' },
      { href: '/admin', label: 'Admin' },
    ],
  },
  {
    key: 'voice',
    label: 'Voice',
    blurb: 'Brand AI',
    icon: <Sparkles size={14} />,
    rootMatcher: p => p.startsWith('/voice'),
    items: [
      { href: '/voice', label: 'Library hub' },
      { href: '/voice/templates', label: 'Templates' },
      { href: '/voice/briefs', label: 'Briefs' },
      { href: '/voice/playground', label: 'Playground' },
      { href: '/voice/runs', label: 'Runs' },
      { href: '/voice/settings/glossary', label: 'Glossary' },
      { href: '/voice/settings/service-tokens', label: 'Service tokens' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    blurb: 'Sales',
    icon: <LayoutGrid size={14} />,
    rootMatcher: p => p.startsWith('/crm'),
    items: [
      { href: '/crm', label: 'Pipeline' },
      { href: '/crm/inbox', label: 'Inbox' },
      { href: '/crm/reports', label: 'Reports' },
      { href: '/crm/settings/sources', label: 'Sources' },
      { href: '/crm/settings/lost-reasons', label: 'Lost reasons' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    blurb: 'Performance',
    icon: <BarChart3 size={14} />,
    rootMatcher: p => p.startsWith('/analytics'),
    items: [
      { href: '/analytics', label: 'Agency overview' },
      { href: '/analytics/recommendations', label: 'Recommendations' },
      { href: '/analytics/integrations', label: 'Integrations' },
      { href: '/analytics/import', label: 'Import' },
      { href: '/analytics/settings', label: 'Settings' },
    ],
  },
  {
    key: 'engineering',
    label: 'Engineering',
    blurb: 'Internal tools',
    icon: <Code2 size={14} />,
    rootMatcher: p => p.startsWith('/dev'),
    items: [
      { href: '/dev', label: 'Dev home' },
      { href: '/dev/monitors', label: 'Monitors' },
      { href: '/dev/projects/discover', label: 'Discover' },
    ],
  },
];

export function TopBar({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const deptRef = useRef<HTMLDivElement | null>(null);

  // close the More dropdown on outside click / escape
  useEffect(() => {
    if (!deptOpen) return;
    function onClick(e: MouseEvent) {
      if (!deptRef.current) return;
      if (!deptRef.current.contains(e.target as Node)) setDeptOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeptOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [deptOpen]);

  // close menus on route change
  useEffect(() => {
    setDeptOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const deptActive = SECONDARY.some(s => s.rootMatcher(pathname));

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
              Agency operating engine
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-cream/70 md:flex">
          {PRIMARY_NAV.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              active={item.matcher(pathname)}
              icon={item.icon}
              badge={
                item.href === '/approvals' && pendingApprovals > 0
                  ? pendingApprovals
                  : undefined
              }
            >
              {item.label}
            </NavLink>
          ))}

          <div ref={deptRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={deptOpen}
              onClick={() => setDeptOpen(o => !o)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.08em] transition-colors duration-150',
                deptActive || deptOpen
                  ? 'bg-cream/10 text-cream'
                  : 'text-cream/70 hover:bg-cream/5 hover:text-cream'
              )}
            >
              <LayoutGrid size={14} />
              <span>More</span>
              <ChevronDown
                size={12}
                className={cn('transition-transform duration-150', deptOpen && 'rotate-180')}
              />
            </button>

            {deptOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-40 grid w-[640px] grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-stone-200/80 bg-cream-lt p-5 text-charcoal shadow-xl"
              >
                {SECONDARY.map(section => (
                  <DeptSection
                    key={section.key}
                    section={section}
                    pathname={pathname}
                    onPick={() => setDeptOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </nav>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen(o => !o)}
          className="rounded-md border border-cream/20 p-2 text-cream md:hidden"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-cream/10 bg-green-deep px-6 py-4 md:hidden">
          <nav className="grid gap-1 text-[11px] uppercase tracking-[0.08em] text-cream/70">
            {PRIMARY_NAV.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                active={item.matcher(pathname)}
                icon={item.icon}
                onClick={() => setMobileOpen(false)}
                full
                badge={
                  item.href === '/approvals' && pendingApprovals > 0
                    ? pendingApprovals
                    : undefined
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-5 grid gap-5 border-t border-cream/10 pt-5">
            {SECONDARY.map(section => (
              <div key={section.key} className="grid gap-1">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-cream/55">
                  {section.icon}
                  <span>{section.label}</span>
                </div>
                <div className="grid gap-1 pl-1">
                  {section.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'rounded-md px-3 py-2 text-[12px] normal-case tracking-normal transition-colors duration-150',
                        pathname === item.href
                          ? 'bg-cream/10 text-cream'
                          : 'text-cream/75 hover:bg-cream/5 hover:text-cream'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function DeptSection({
  section,
  pathname,
  onPick,
}: {
  section: SecondarySection;
  pathname: string;
  onPick: () => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2 border-b border-stone-200/70 pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-700">
          {section.icon}
          <span>{section.label}</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.08em] text-stone-400">
          {section.blurb}
        </span>
      </div>
      <ul className="grid gap-0.5">
        {section.items.map(item => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onPick}
                className={cn(
                  'block rounded-md px-2 py-1.5 text-[13px] text-stone-700 transition-colors duration-150',
                  active
                    ? 'bg-stone-50 text-stone-900'
                    : 'hover:bg-stone-50 hover:text-stone-900'
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
  onClick,
  full,
  badge,
}: {
  href: string;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  full?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors duration-150',
        full && 'w-full',
        active
          ? 'bg-cream/10 text-cream after:absolute after:inset-x-2 after:-bottom-[1px] after:h-[2px] after:rounded-full after:bg-amber-deep'
          : 'hover:bg-cream/5 hover:text-cream'
      )}
    >
      {icon}
      <span>{children}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="ml-1 rounded-full bg-amber-deep px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-normal text-charcoal">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
