import Link from 'next/link';
import { cn } from '@/lib/utils';

export function SettingsTabs({
  current,
}: {
  current: 'glossary' | 'service-tokens';
}) {
  return (
    <div className="mt-3 inline-flex gap-2 text-xs uppercase tracking-eyebrow">
      <Tab href="/voice/settings/glossary" active={current === 'glossary'}>
        Glossary
      </Tab>
      <Tab
        href="/voice/settings/service-tokens"
        active={current === 'service-tokens'}
      >
        Service tokens
      </Tab>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md border px-3 py-1.5',
        active
          ? 'border-green-deep/30 bg-cream/60 text-green-deep'
          : 'border-cream-dk/40 bg-white text-charcoal/60 hover:border-amber-mid/50 hover:text-amber-deep'
      )}
    >
      {children}
    </Link>
  );
}
