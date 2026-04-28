import { addDays, isWithinInterval, parseISO } from 'date-fns';
import {
  PULSE_HOUSE_SLUG,
  type Client,
  type Post,
  type Shoot,
} from './types';

// ───────────────────────────────────────────────────────────────────────────
// Field-plan helpers — turn raw shoots/posts into operational signal:
//  - Group shoots by date (the day's run of show)
//  - Detect co-located shoots (batch opportunities)
//  - Surface ride-along candidates (Pulse content that could be captured
//    during a host shoot's window)
// ───────────────────────────────────────────────────────────────────────────

export function normalizeLocation(s: string | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/** Two shoots are "co-located" when they share a normalized location. */
export function isColocated(a: Shoot, b: Shoot): boolean {
  const la = normalizeLocation(a.location);
  const lb = normalizeLocation(b.location);
  if (!la || !lb) return false;
  return la === lb;
}

export interface FieldDay {
  date: string; // yyyy-mm-dd
  shoots: Shoot[];
  /** Groups of co-located shoots within this day (length >= 2). */
  colocations: Shoot[][];
}

/** Group shoots by scheduled_date and find co-located clusters per day. */
export function groupShootsByDay(shoots: Shoot[]): FieldDay[] {
  const byDate = new Map<string, Shoot[]>();
  for (const s of shoots) {
    if (!s.scheduled_date) continue;
    const arr = byDate.get(s.scheduled_date) ?? [];
    arr.push(s);
    byDate.set(s.scheduled_date, arr);
  }
  const days = Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, list]) => {
      const buckets = new Map<string, Shoot[]>();
      for (const s of list) {
        const key = normalizeLocation(s.location);
        if (!key) continue;
        const arr = buckets.get(key) ?? [];
        arr.push(s);
        buckets.set(key, arr);
      }
      const colocations = Array.from(buckets.values()).filter(g => g.length >= 2);
      return {
        date,
        shoots: list.sort((a, b) =>
          (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')
        ),
        colocations,
      };
    });
  return days;
}

/**
 * Pulse posts that fall within `windowDays` after the host shoot date AND have
 * no shoot bundle assigned — these are candidates to be captured "for free"
 * during the host shoot.
 */
export function rideAlongCandidates(args: {
  hostShoot: Shoot;
  pulseClient: Client | null;
  pulsePosts: Post[];
  windowDays?: number;
}): Post[] {
  const { hostShoot, pulseClient, pulsePosts, windowDays = 14 } = args;
  if (!pulseClient || !hostShoot.scheduled_date) return [];
  const start = parseISO(hostShoot.scheduled_date);
  const end = addDays(start, windowDays);
  return pulsePosts.filter(p => {
    if (p.shoot_id) return false; // already on a shoot
    const d = parseISO(p.post_date);
    return isWithinInterval(d, { start, end });
  });
}

export function isPulseHouse(client: Client | null | undefined): boolean {
  return !!client && client.slug === PULSE_HOUSE_SLUG;
}
