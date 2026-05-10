import { NextResponse } from 'next/server';
import { pollAllProjects } from '@/lib/dev/monitors/github';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await pollAllProjects();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
