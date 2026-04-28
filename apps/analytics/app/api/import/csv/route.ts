import { NextResponse } from 'next/server';
import { runImportCsv } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id') ?? '';
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'client_id required' }, { status: 400 });
  }

  let csv = '';
  try {
    csv = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'failed to read body' }, { status: 400 });
  }
  if (!csv || csv.length < 10) {
    return NextResponse.json({ ok: false, error: 'empty body' }, { status: 400 });
  }

  const fd = new FormData();
  fd.set('client_id', clientId);
  fd.set('csv', csv);
  try {
    const result = await runImportCsv(fd);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
