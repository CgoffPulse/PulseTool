// TODO(auth): wire bearer-token auth before exposing this beyond local dev.

import { NextResponse } from 'next/server';
import { decideApproval } from '@/lib/command/actions';
import type { ApprovalDecision, ApproverKind } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APPROVERS: ApproverKind[] = ['christian', 'client'];
const STATUSES: ApprovalDecision[] = ['approved', 'changes_requested'];

interface DecideBody {
  approver?: unknown;
  status?: unknown;
  note?: unknown;
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
  }

  let body: DecideBody = {};
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const approver = asString(body.approver);
  if (!approver || !APPROVERS.includes(approver as ApproverKind)) {
    return NextResponse.json({ ok: false, error: 'invalid approver' }, { status: 400 });
  }
  const status = asString(body.status);
  if (!status || !STATUSES.includes(status as ApprovalDecision)) {
    return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 });
  }

  const result = await decideApproval(id, {
    approver: approver as ApproverKind,
    status: status as ApprovalDecision,
    note: asString(body.note),
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
