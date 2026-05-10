'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Person } from '@/lib/social/types';

const STORAGE_KEY = 'pulse:active-person-id';

interface PersonContextValue {
  people: Person[];
  active: Person | null;
  setActiveId: (id: string | null) => void;
}

const PersonContext = createContext<PersonContextValue | null>(null);

export function PersonProvider({
  people,
  children,
}: {
  people: Person[];
  children: React.ReactNode;
}) {
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage exactly once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && people.some(p => p.id === raw)) {
      setActiveIdState(raw);
    }
    setHydrated(true);
  }, [people]);

  const setActiveId = (id: string | null) => {
    setActiveIdState(id);
    if (typeof window === 'undefined') return;
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<PersonContextValue>(() => {
    const active = activeId ? people.find(p => p.id === activeId) ?? null : null;
    return { people, active, setActiveId };
  }, [people, activeId]);

  // Suppress the SSR/CSR mismatch dance: we render `null` for active until we
  // hydrate, then the real value flows in. This avoids a one-frame "Pick who
  // you are" flash for returning users.
  if (!hydrated) {
    return (
      <PersonContext.Provider value={{ ...value, active: null }}>
        {children}
      </PersonContext.Provider>
    );
  }

  return <PersonContext.Provider value={value}>{children}</PersonContext.Provider>;
}

export function usePerson(): PersonContextValue {
  const v = useContext(PersonContext);
  if (!v) throw new Error('usePerson must be used inside <PersonProvider>');
  return v;
}
