import { listPeople } from '@/lib/social/queries';
import { PersonProvider } from '@/components/social/person-context';

/**
 * Wraps the (social) route group with the PersonProvider so social-specific
 * components (today-rail, today-board, notification-bell, person-picker,
 * notifications-feed) can call usePerson() without each page wiring it up.
 *
 * Failure is silent: if people can't be loaded (DB down, schema missing),
 * we hand the provider an empty array and pages render with active=null.
 */
async function safeListPeople() {
  try {
    return await listPeople();
  } catch {
    return [];
  }
}

export default async function SocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const people = await safeListPeople();
  return <PersonProvider people={people}>{children}</PersonProvider>;
}
