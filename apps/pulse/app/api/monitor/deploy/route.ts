import { NextResponse } from 'next/server';
import { pollAllDeploys } from '@/lib/dev/monitors/deploy';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await pollAllDeploys();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
