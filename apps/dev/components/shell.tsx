import { TopBar } from './top-bar';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-16">{children}</main>
      <footer className="mt-12 border-t border-slate-500/20 bg-ink-deep">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 text-xs text-slate-400">
          <span>Pulse Dev · Sister tool to Pulse Social</span>
          <span className="font-mono text-2xs">:3001</span>
        </div>
      </footer>
    </div>
  );
}
