import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { q } from '@/lib/db';
import { generateRecsForClient } from '@/lib/actions';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;
  const t0 = Date.now();

  let clientIds: string[] = [];
  try {
    const rows = await q<{ client_id: string }>(
      `select distinct client_id from analytics.platform_accounts where status = 'connected'`
    );
    clientIds = rows.map(r => r.client_id);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, ms: Date.now() - t0 },
      { status: 500 }
    );
  }

  let totalInserted = 0;
  let stubCount = 0;
  for (const clientId of clientIds) {
    try {
      const r = await generateRecsForClient(clientId);
      totalInserted += r.inserted;
      if (r.stub) stubCount++;
    } catch (err) {
      console.warn(
        '[cron generate-recommendations] client failed',
        clientId,
        (err as Error).message
      );
    }
  }

  return NextResponse.json({
    ok: true,
    clients: clientIds.length,
    inserted: totalInserted,
    stub_clients: stubCount,
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
