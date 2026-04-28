'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function MonthTabs({ base }: { base: string }) {
  const pathname = usePathname();
  const tabs = [
    { key: 'planning', label: 'Planning' },
    { key: 'production', label: 'Production' },
    { key: 'calendar', label: 'Calendar' },
  ];
  return (
    <nav className="flex items-end gap-7">
      {tabs.map(t => {
        const href = `${base}/${t.key}`;
        const active = pathname?.endsWith(`/${t.key}`) ?? false;
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              'relative pb-3 text-base transition-colors duration-fast',
              active
                ? 'font-display font-bold text-green-deep'
                : 'text-charcoal/55 hover:text-green-deep'
            )}
          >
            {t.label}
            {active ? (
              <span className="absolute -bottom-px left-0 h-[2px] w-full bg-amber-mid" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
