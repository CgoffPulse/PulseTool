import { listAllNotifications, listClients, listPeople } from '@/lib/queries';
import { NotificationsFeed } from '@/components/notifications-feed';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const [notifications, clients, people] = await Promise.all([
    listAllNotifications(),
    listClients(),
    listPeople(),
  ]);
  return (
    <NotificationsFeed
      notifications={notifications}
      clients={clients}
      people={people}
    />
  );
}
