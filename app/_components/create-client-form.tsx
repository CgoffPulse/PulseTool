'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/actions';

const FIELD =
  'w-full rounded-md border border-cream-dk bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/35 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/30';

export function CreateClientForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    start(async () => {
      await createClient({ name, slug });
      setName('');
      setSlug('');
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <input
        className={FIELD}
        placeholder="Client name"
        value={name}
        onChange={e => {
          setName(e.target.value);
          if (!slug) setSlug(slugify(e.target.value));
        }}
      />
      <input
        className={FIELD + ' font-mono text-xs'}
        placeholder="slug"
        value={slug}
        onChange={e => setSlug(slugify(e.target.value))}
      />
      <button
        type="submit"
        disabled={pending || !name || !slug}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-green-deep px-4 py-2.5 text-xs uppercase tracking-label text-cream transition-colors duration-fast hover:bg-charcoal disabled:opacity-40"
      >
        {pending ? 'Creating…' : 'Create client'}
        <ArrowRight size={14} />
      </button>
    </form>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
