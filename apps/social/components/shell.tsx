import Link from 'next/link';
import { listClients } from '@/lib/queries';
import { TopBar } from './top-bar';

export async function Shell({ children }: { children: React.ReactNode }) {
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  try {
    clients = await listClients();
  } catch {
    /* surface auth errors on the page itself */
  }

  return (
    <div className="min-h-screen">
      <TopBar clients={clients} />

      <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-16">{children}</main>

      <footer className="no-print mt-12 grain bg-green-deep text-cream">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold leading-none">Pulse</span>
            <span className="opacity-60">·</span>
            <span className="opacity-70">Social planning · Bentonville, AR</span>
          </div>
          <div className="flex items-center gap-5 opacity-80">
            <Link href="/" className="hover:text-amber-mid">
              Hub
            </Link>
            <Link href="/clients" className="hover:text-amber-mid">
              Clients
            </Link>
            <Link href="/holidays" className="hover:text-amber-mid">
              Holidays
            </Link>
            <Link href="/shoot-templates" className="hover:text-amber-mid">
              Shoot templates
            </Link>
            <span className="opacity-50">Growing together.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
