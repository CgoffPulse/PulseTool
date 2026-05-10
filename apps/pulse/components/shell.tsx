import { TopBar } from './top-bar';
import { HealthFooter } from './health-footer';
import { getApprovalsQueue } from '@/lib/command/queries';

async function getPendingApprovalsCount(): Promise<number> {
  try {
    const q = await getApprovalsQueue();
    return Array.isArray(q) ? q.length : 0;
  } catch {
    return 0;
  }
}

export async function Shell({ children }: { children: React.ReactNode }) {
  const pendingApprovals = await getPendingApprovalsCount();
  return (
    <div className="min-h-screen bg-cream-lt">
      <TopBar pendingApprovals={pendingApprovals} />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-20">{children}</main>
      <HealthFooter />
    </div>
  );
}
