import Link from 'next/link';
import { Check, X as XIcon } from 'lucide-react';
import { getApprovalsQueue, listApprovals } from '@/lib/command-queries';
import { ApprovalDecisionForm } from './decision-form';
import type { ApprovalQueueItem, Approval } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  show?: string;
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const showAll = sp.show === 'all';

  const [pending, decided] = await Promise.all([
    getApprovalsQueue(),
    showAll ? listApprovals() : Promise.resolve([] as Approval[]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Approvals
        </span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            Christian&rsquo;s queue
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/approvals"
              className={
                !showAll
                  ? 'rounded-md bg-stone-900 px-3 py-1.5 text-[12px] font-medium text-white'
                  : 'rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[12px] text-stone-600 hover:bg-stone-50'
              }
            >
              Pending
            </Link>
            <Link
              href="/approvals?show=all"
              className={
                showAll
                  ? 'rounded-md bg-stone-900 px-3 py-1.5 text-[12px] font-medium text-white'
                  : 'rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[12px] text-stone-600 hover:bg-stone-50'
              }
            >
              All
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          Posts, briefs, recaps, and project closures awaiting sign-off. Hold the bar — empty here
          means the team can ship.
        </p>
      </header>

      {pending.length === 0 && !showAll ? (
        <InboxZero />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-stone-600">
            Pending · {pending.length}
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-10 text-center text-[14px] text-stone-600">
              Nothing pending. The wire is clear.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map(a => (
                <ApprovalRow key={a.id} approval={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {showAll && decided.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-stone-600">
            Decided
          </h2>
          <div className="flex flex-col gap-2">
            {decided
              .filter(a => a.state !== 'pending')
              .slice(0, 50)
              .map(a => (
                <DecidedRow key={a.id} approval={a} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ApprovalRow({ approval }: { approval: ApprovalQueueItem }) {
  const waiting =
    approval.waiting_hours < 1
      ? '<1h'
      : approval.waiting_hours < 24
        ? `${approval.waiting_hours}h`
        : `${Math.floor(approval.waiting_hours / 24)}d`;
  const required = approval.required_approvers;
  const receivedKinds = new Set(approval.received.map(r => r.approver));
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
            {approval.artifact_kind}
            {approval.client_name && <> · {approval.client_name}</>}
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-stone-900">
            {approval.artifact_title ?? approval.artifact_slug ?? 'Untitled artifact'}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-stone-500">
            <span>Waiting {waiting}</span>
            <span>·</span>
            <span>
              Needs:{' '}
              {required.map((r, i) => (
                <span key={r}>
                  <span
                    className={
                      receivedKinds.has(r)
                        ? 'rounded-full bg-green-mid/10 px-1.5 py-0.5 text-green-deep'
                        : 'rounded-full bg-stone-100 px-1.5 py-0.5 text-stone-700'
                    }
                  >
                    {r}
                  </span>
                  {i < required.length - 1 && ' '}
                </span>
              ))}
            </span>
          </div>
        </div>
        <ApprovalDecisionForm id={approval.id} />
      </div>
    </article>
  );
}

function DecidedRow({ approval }: { approval: Approval }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
            {approval.artifact_kind}
            {approval.client_name && <> · {approval.client_name}</>}
          </div>
          <div className="mt-0.5 text-[13px] text-stone-800">
            {approval.artifact_title ?? approval.artifact_slug ?? 'Untitled'}
          </div>
        </div>
        <span
          className={
            approval.state === 'approved'
              ? 'inline-flex items-center gap-1 rounded-full border border-green-mid/30 bg-green-mid/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-green-deep'
              : 'inline-flex items-center gap-1 rounded-full border border-bad/30 bg-bad/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-bad'
          }
        >
          {approval.state === 'approved' ? <Check size={11} /> : <XIcon size={11} />}
          {approval.state.replace(/_/g, ' ')}
        </span>
      </div>
    </article>
  );
}

function InboxZero() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-stone-200 bg-white px-6 py-20 text-center">
      <div className="rounded-full border border-green-mid/30 bg-green-mid/10 p-3">
        <Check size={20} className="text-green-deep" />
      </div>
      <div>
        <h3 className="font-display text-xl font-semibold text-stone-900">Inbox zero</h3>
        <p className="mt-2 max-w-md text-[14px] leading-[1.55] text-stone-600">
          Nothing waiting on you. The team can keep moving.
        </p>
      </div>
    </div>
  );
}
