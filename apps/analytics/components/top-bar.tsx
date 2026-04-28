'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutGrid,
  Menu,
  Plug,
  Settings as SettingsIcon,
  Sparkles,
  Upload,
  Users,
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
  {
    href: '/',
    label: 'Overview',
    icon: <LayoutGrid size={14} />,
    matcher: p => p === '/',
  },
  {
    href: '/recommendations',
    label: 'Recs',
    icon: <Sparkles size={14} />,
    matcher: p => p.startsWith('/recommendations') || p.startsWith('/clients'),
  },
  {
    href: '/integrations',
    label: 'Integrations',
    icon: <Plug size={14} />,
    matcher: p => p.startsWith('/integrations'),
  },
  {
    href: '/import',
    label: 'Import',
    icon: <Upload size={14} />,
    matcher: p => p.startsWith('/import'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: <SettingsIcon size={14} />,
    matcher: p => p.startsWith('/settings'),
  },
];

export function TopBar() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 grain border-b border-cream/10 bg-green-deep/95 text-cream backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="group flex items-center gap-3">
          <BrandMark size={28} tone="inverse" />
          <span className="leading-tight">
            <span className="block font-display text-xl font-bold tracking-display">
              Pulse <span className="italic-amber font-display">analytics</span>
            </span>
            <span className="block text-[10px] uppercase tracking-eyebrow text-cream/65">
              Performance &middot; insights &middot; recommendations
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-1 text-xs uppercase tracking-eyebrow text-cream/70">
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
          <span aria-hidden className="h-6 w-px bg-cream/15" />
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-mid/60 bg-amber-mid px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal hover:bg-amber-deep hover:text-cream-lt"
          >
            <Users size={14} />
            <span>Connect a client</span>
          </Link>
        </div>

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
        <nav className="grid gap-1 border-t border-cream/10 bg-green-deep/95 px-6 py-4 text-xs uppercase tracking-eyebrow text-cream/70 md:hidden">
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
        'flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors duration-fast',
        full && 'w-full',
        active ? 'bg-cream/10 text-cream' : 'hover:bg-cream/5 hover:text-cream'
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
