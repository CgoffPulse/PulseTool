import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { q, qOne } from '@/lib/db';
import { pollOne } from '@/lib/dev/monitors/github';
import type { MonitoredProject } from '@/lib/dev/types';

export const dynamic = 'force-dynamic';

interface PushEvent {
  ref?: string;
  repository?: { full_name?: string; default_branch?: string };
  head_commit?: {
    id?: string;
    message?: string;
    timestamp?: string;
  };
}

interface PullRequestEvent {
  action?: string;
  repository?: { full_name?: string };
}

function verifySignature(secret: string, signature: string, raw: string): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const provided = signature.slice('sha256='.length);
  const digest = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(digest, 'hex');
  let b: Buffer;
  try {
    b = Buffer.from(provided, 'hex');
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function findProject(repoFullName: string) {
  return qOne<MonitoredProject>(
    `select p.id, p.name, p.slug, p.state::text as state,
            p.summary, p.current_focus,
            p.github_repo, p.local_path, p.vercel_project_id,
            p.archived_at, p.updated_at
       from command.projects p
      where p.kind = 'internal_build'
        and p.github_repo = $1
      limit 1`,
    [repoFullName]
  );
}

async function handlePush(body: PushEvent) {
  const repoName = body.repository?.full_name;
  const defaultBranch = body.repository?.default_branch;
  if (!repoName || !defaultBranch) {
    return NextResponse.json({ ok: true, matched: false, reason: 'missing repo' });
  }

  if (body.ref !== `refs/heads/${defaultBranch}`) {
    return NextResponse.json({ ok: true, ignored: 'non-default branch' });
  }

  const project = await findProject(repoName);
  if (!project) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const head = body.head_commit;
  await q(
    `insert into dev.repo_activity
       (project_id, default_branch, last_commit_sha, last_commit_at,
        last_commit_message, open_pr_count, open_issue_count)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      project.id,
      defaultBranch,
      head?.id ?? null,
      head?.timestamp ?? null,
      head?.message ? head.message.split('\n')[0] : null,
      null,
      null,
    ]
  );

  return NextResponse.json({ ok: true, matched: true, event: 'push' });
}

async function handlePullRequest(body: PullRequestEvent) {
  const repoName = body.repository?.full_name;
  if (!repoName) {
    return NextResponse.json({ ok: true, matched: false, reason: 'missing repo' });
  }

  const action = body.action;
  if (action !== 'opened' && action !== 'closed' && action !== 'reopened') {
    return NextResponse.json({ ok: true, ignored: `pr.${action}` });
  }

  const project = await findProject(repoName);
  if (!project) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    // Without a token we can't re-poll counts; ack so GitHub doesn't retry.
    return NextResponse.json({
      ok: true,
      matched: true,
      acked: true,
      reason: 'no GITHUB_TOKEN',
    });
  }

  try {
    const polled = await pollOne(repoName, token);
    await q(
      `insert into dev.repo_activity
         (project_id, default_branch, last_commit_sha, last_commit_at,
          last_commit_message, open_pr_count, open_issue_count)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        project.id,
        polled.default_branch,
        polled.last_commit_sha,
        polled.last_commit_at,
        polled.last_commit_message,
        polled.open_pr_count,
        polled.open_issue_count,
      ]
    );
    return NextResponse.json({ ok: true, matched: true, event: 'pull_request', action });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  const event = req.headers.get('x-github-event') ?? '';

  const raw = await req.text();

  if (!secret || !verifySignature(secret, signature, raw)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid json' },
      { status: 400 }
    );
  }

  if (event === 'push') {
    return handlePush(body as PushEvent);
  }
  if (event === 'pull_request') {
    return handlePullRequest(body as PullRequestEvent);
  }

  return NextResponse.json({ ok: true, ignored: event });
}
