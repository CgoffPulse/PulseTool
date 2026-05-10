// Pulse Analytics — number / date formatters used across analytics pages.
// Kept separate from the general `lib/format.ts` (which handles money)
// because the analytics surface uses k/M-truncated numbers and percentages.

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function formatNumberFull(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'soon';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function snippet(text: string | null | undefined, len = 80): string {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= len) return trimmed;
  return `${trimmed.slice(0, len - 1)}…`;
}
