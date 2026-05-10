import { clsx, type ClassValue } from 'clsx';
import { format, parse, parseISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse "yyyy-MM" into ISO first-of-month, e.g. "2026-05" -> "2026-05-01". */
export function monthSlugToIso(slug: string): string {
  return parse(`${slug}-01`, 'yyyy-MM-dd', new Date()).toISOString().slice(0, 10);
}

export function monthSlug(monthIso: string): string {
  return monthIso.slice(0, 7);
}

export function fmtMonth(monthIso: string): string {
  return format(parseISO(monthIso), 'LLLL yyyy');
}

export function fmtDate(iso: string): string {
  return format(parseISO(iso), 'EEE MMM d');
}

export function fmtDayName(iso: string): string {
  return format(parseISO(iso), 'EEEE');
}
