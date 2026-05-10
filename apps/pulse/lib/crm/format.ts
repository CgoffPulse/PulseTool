/**
 * CRM-local formatters. Pulse's top-level `lib/format.ts` already covers
 * `formatMoney`, `formatMoneyFull`, and `timeAgo`; this module adds the
 * CRM-specific ones (`parseMoneyToCents`, `formatDate`, `formatDateShort`).
 *
 * We re-export the shared helpers so CRM callsites only need to import
 * from one place (`@/lib/crm/format`).
 */
export { formatMoney, formatMoneyFull, timeAgo } from '../format';

export function parseMoneyToCents(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
