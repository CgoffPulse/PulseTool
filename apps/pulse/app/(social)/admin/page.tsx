import {
  listExpectationCompletions,
  listPeople,
  listRecurringExpectations,
} from '@/lib/social/queries';
import { AdminTabs } from './_admin-tabs';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [people, expectations, completions] = await Promise.all([
    listPeople(),
    listRecurringExpectations(),
    listExpectationCompletions(),
  ]);

  return (
    <div className="space-y-8">
      <header className="border-b border-cream-dk/60 pb-6">
        <div className="eyebrow">Command center</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          Set the <span className="italic text-amber-deep">standard</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          Roles, responsibilities, and the recurring expectations the team
          should hit every cycle. The action engine watches these and pings
          the right person when a deadline is approaching.
        </p>
      </header>
      <AdminTabs
        initialTab={tab === 'expectations' ? 'expectations' : 'people'}
        people={people}
        expectations={expectations}
        completions={completions}
      />
    </div>
  );
}
