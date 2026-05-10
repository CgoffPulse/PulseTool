import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { pollAllProjects } from '@/lib/dev/monitors/github';
import { pollAllDeploys } from '@/lib/dev/monitors/deploy';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const t0 = Date.now();
  const [gh, vc] = await Promise.allSettled([
    pollAllProjects(),
    pollAllDeploys(),
  ]);

  return NextResponse.json({
    ok: true,
    github:
      gh.status === 'fulfilled'
        ? gh.value
        : { error: (gh.reason as Error).message },
    vercel:
      vc.status === 'fulfilled'
        ? vc.value
        : { error: (vc.reason as Error).message },
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
