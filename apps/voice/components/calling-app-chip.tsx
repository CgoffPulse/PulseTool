import { cn } from '@/lib/utils';

const CHIP_CLASS: Record<string, string> = {
  crm: 'bg-amber-mid/20 text-amber-deep',
  social: 'bg-green-mid/20 text-green-deep',
  analytics: 'bg-rust-200/20 text-rust-300',
  voice: 'bg-green-deep text-cream-lt',
  huddle: 'bg-cream/60 text-charcoal/80 border border-cream-dk/70',
};

export function CallingAppChip({
  app,
  size = 'md',
}: {
  app: string;
  size?: 'sm' | 'md';
}) {
  const cls = CHIP_CLASS[app] ?? 'bg-cream/40 text-charcoal/75';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-eyebrow',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        cls
      )}
    >
      {app}
    </span>
  );
}

const STATUS_CLASS: Record<string, string> = {
  ok: 'bg-green-mid/20 text-green-deep',
  stub: 'bg-amber/15 text-amber-deep',
  error: 'bg-bad/15 text-bad',
};

export function StatusChip({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? 'bg-cream/40 text-charcoal/70';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow',
        cls
      )}
    >
      {status}
    </span>
  );
}
