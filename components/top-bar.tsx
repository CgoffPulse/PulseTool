'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { CalendarDays, LayoutDashboard, Tag, Users } from 'lucide-react';
import type { Client } from '@/lib/types';
import { BrandMark } from './brand-mark';
import { ClientSwitcher } from './client-switcher';
import { MonthSwitcher } from './month-switcher';
import { cn } from '@/lib/utils';

export function TopBar({ clients }: { clients: Client[] }) {
  const pathname = usePathname() ?? '/';
  const ctx = useMemo(() => parseRoute(pathname), [pathname]);
  const activeClient = ctx.slug ? clients.find(c => c.slug === ctx.slug) : null;

  return (
    <header className="no-print sticky top-0 z-30 grain border-b border-cream/10 bg-green-deep/95 text-cream backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="group flex items-center gap-3">
            <span className="rounded-md bg-cream-lt p-1.5">
              <BrandMark size={28} />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-xl font-bold tracking-display">
                Pulse
              </span>
              <span className="block text-[10px] uppercase tracking-eyebrow text-cream/65">
                Social Planning
              </span>
            </span>
          </Link>

          {clients.length > 0 ? (
            <div className="hidden items-center gap-3 md:flex">
              <Divider />
              <ClientSwitcher clients={clients} active={activeClient ?? null} />
              {ctx.slug && ctx.month ? (
                <>
                  <Divider />
                  <MonthSwitcher slug={ctx.slug} month={ctx.month} section={ctx.section} />
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <nav className="flex items-center gap-1 text-xs uppercase tracking-eyebrow text-cream/70">
          <NavLink href="/" active={pathname === '/'} icon={<LayoutDashboard size={14} />}>
            Hub
          </NavLink>
          <NavLink
            href="/clients"
            active={pathname === '/clients'}
            icon={<Users size={14} />}
          >
            Clients
          </NavLink>
          <NavLink
            href="/holidays"
            active={pathname.startsWith('/holidays')}
            icon={<CalendarDays size={14} />}
          >
            Holidays
          </NavLink>
          <NavLink
            href="/shoot-templates"
            active={pathname.startsWith('/shoot-templates')}
            icon={<Tag size={14} />}
          >
            Templates
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function Divider() {
  return <span aria-hidden className="h-7 w-px bg-cream/15" />;
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
          ? 'bg-cream/10 text-cream'
          : 'hover:bg-cream/5 hover:text-cream'
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function parseRoute(pathname: string): {
  slug: string | null;
  month: string | null;
  section: 'planning' | 'production' | 'calendar' | null;
} {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'clients' || !parts[1]) return { slug: null, month: null, section: null };
  const slug = parts[1];
  if (parts[2] !== 'months' || !parts[3]) return { slug, month: null, section: null };
  const month = parts[3];
  const sec = parts[4];
  const section: 'planning' | 'production' | 'calendar' | null =
    sec === 'planning' || sec === 'production' || sec === 'calendar' ? sec : null;
  return { slug, month, section };
}
