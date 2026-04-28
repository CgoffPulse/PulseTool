import { supabaseServer } from '@/lib/supabase/server';
import type { Person } from '@/lib/types';
import { PeopleEditor } from './_editor';

export const dynamic = 'force-dynamic';

/** Includes archived rows so the editor can toggle them back on. */
async function listAllPeople(): Promise<Person[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from('people').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Person[];
}

export default async function PeoplePage() {
  let people: Person[] = [];
  let connError: string | null = null;
  try {
    people = await listAllPeople();
  } catch (err) {
    connError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-cream-dk/60 pb-7">
        <div className="eyebrow">Roster</div>
        <h1 className="mt-3 font-display text-5xl font-black leading-display tracking-display text-green-deep">
          People & <span className="italic text-amber-deep">roles.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base italic text-charcoal/65">
          The team behind every shoot, post, and approval. Roles drive the Today feed
          and notification routing — pick carefully.
        </p>
      </header>

      {connError ? (
        <div className="rounded-lg border border-amber-deep/30 bg-amber-light/30 px-5 py-4 text-sm text-charcoal">
          {connError}
        </div>
      ) : null}

      <PeopleEditor initial={people} />
    </div>
  );
}
