import { TopBar } from './top-bar';
import { HealthFooter } from './health-footer';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-lt">
      <TopBar />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-20">{children}</main>
      <HealthFooter />
    </div>
  );
}
