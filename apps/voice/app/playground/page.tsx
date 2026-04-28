import { listClients, listTemplates } from '@/lib/queries';
import { PlaygroundForm } from './_form';

export default async function PlaygroundPage() {
  const [templates, clients] = await Promise.all([
    listTemplates(),
    listClients(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Playground</span>
        <h1 className="font-display text-4xl font-bold tracking-display text-green-deep">
          Try a <span className="italic-amber">prompt</span>.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Resolve a template, optionally bind a client (so brief + glossary
          inject automatically), and ship the call. The run lands in the feed
          like any other gateway call.
        </p>
      </header>

      <PlaygroundForm templates={templates} clients={clients} />
    </div>
  );
}
