import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth';
import { listStalledLeads } from '@/lib/queries';
import { upsertNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

async function run(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const t0 = Date.now();
  const stalled = await listStalledLeads(7);
  const crmBase = (process.env.NEXT_PUBLIC_CRM_URL ?? '').replace(/\/$/, '');

  let upserted = 0;
  for (const lead of stalled) {
    const name = lead.company ? `${lead.name} (${lead.company})` : lead.name;
    const lastTouched = lead.last_touch_at ?? lead.created_at;
    const ageDays = Math.floor(
      (Date.now() - new Date(lastTouched).getTime()) / 86_400_000
    );
    await upsertNotification({
      dedup_key: `crm-stalled-${lead.id}`,
      title: `CRM: ${name} stalled`,
      detail: `No touch in ${ageDays}d. Move it forward or call it lost.`,
      link_url: crmBase ? `${crmBase}/leads/${lead.id}` : `/leads/${lead.id}`,
      severity: ageDays >= 14 ? 'bad' : 'warn',
      audience_role: 'strategy',
    });
    upserted++;
  }

  return NextResponse.json({
    ok: true,
    stalled: stalled.length,
    upserted,
    ms: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
