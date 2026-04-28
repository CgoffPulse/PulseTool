import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import {
  listAllMonths,
  listAllPostsForMonths,
  listAllShootsForMonths,
  listClients,
  listOpenNotifications,
} from '@/lib/queries';
import { TodayBoard } from '@/components/today-board';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const [clients, months, notifications] = await Promise.all([
    listClients(),
    listAllMonths(),
    listOpenNotifications(),
  ]);
  const monthIds = months.map(m => m.id);
  const [posts, shoots] = await Promise.all([
    listAllPostsForMonths(monthIds),
    listAllShootsForMonths(monthIds),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

  const todayShoots = shoots.filter(
    s =>
      s.scheduled_date &&
      parseISO(s.scheduled_date).toDateString() === today.toDateString()
  );
  const weekShoots = shoots.filter(
    s =>
      s.scheduled_date &&
      isWithinInterval(parseISO(s.scheduled_date), { start: weekStart, end: weekEnd })
  );
  const todayPosts = posts.filter(
    p => parseISO(p.post_date).toDateString() === today.toDateString()
  );
  const weekPosts = posts.filter(p =>
    isWithinInterval(parseISO(p.post_date), { start: weekStart, end: weekEnd })
  );

  return (
    <TodayBoard
      todayIso={format(today, 'yyyy-MM-dd')}
      weekStartIso={format(weekStart, 'yyyy-MM-dd')}
      weekEndIso={format(weekEnd, 'yyyy-MM-dd')}
      clients={clients}
      months={months}
      notifications={notifications}
      todayShoots={todayShoots}
      weekShoots={weekShoots}
      todayPosts={todayPosts}
      weekPosts={weekPosts}
    />
  );
}
