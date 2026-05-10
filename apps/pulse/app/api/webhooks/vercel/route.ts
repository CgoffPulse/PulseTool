import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { q, qOne } from '@/lib/db';
import type { MonitoredProject } from '@/lib/dev/types';

export const dynamic = 'force-dynamic';

interface VercelDeploymentWebhook {
  type: string;
  payload: {
    deployment: {
      id?: string;
      url?: string;
      target?: string | null;
      meta?: { githubCommitSha?: string };
    };
    project: { id: string; name?: string };
  };
}

const STATE_MAP: Record<string, string> = {
  succeeded: 'READY',
  error: 'ERROR',
  created: 'BUILDING',
  canceled: 'CANCELED',
};

function verifySignature(secret: string, signature: string, raw: string): boolean {
  const digest = createHmac('sha1', secret).update(raw).digest('hex');
  const a = Buffer.from(digest, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const signature = req.headers.get('x-vercel-signature') ?? '';

  // Read raw body BEFORE parsing — signature is over the raw bytes.
  const raw = await req.text();

  if (!secret || !signature || !verifySignature(secret, signature, raw)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  let body: VercelDeploymentWebhook;
  try {
    body = JSON.parse(raw) as VercelDeploymentWebhook;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid json' },
      { status: 400 }
    );
  }

  const suffix = body.type?.split('.').pop() ?? '';
  const state = STATE_MAP[suffix];
  if (!state) {
    return NextResponse.json({ ok: true, ignored: body.type });
  }

  const vercelProjectId = body.payload?.project?.id;
  if (!vercelProjectId) {
    return NextResponse.json(
      { ok: false, error: 'missing project id' },
      { status: 400 }
    );
  }

  const project = await qOne<MonitoredProject>(
    `select p.id, p.name, p.slug, p.state::text as state,
            p.summary, p.current_focus,
            p.github_repo, p.local_path, p.vercel_project_id,
            p.archived_at, p.updated_at
       from command.projects p
      where p.kind = 'internal_build'
        and p.vercel_project_id = $1
      limit 1`,
    [vercelProjectId]
  );

  if (!project) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const deployment = body.payload.deployment ?? {};
  const url = deployment.url ? `https://${deployment.url}` : null;
  const commitSha = deployment.meta?.githubCommitSha ?? null;

  await q(
    `insert into dev.deployments
       (project_id, provider, state, url, commit_sha, deployed_at)
     values ($1, 'vercel', $2, $3, $4, $5)`,
    [project.id, state, url, commitSha, new Date().toISOString()]
  );

  return NextResponse.json({ ok: true, matched: true, state });
}
