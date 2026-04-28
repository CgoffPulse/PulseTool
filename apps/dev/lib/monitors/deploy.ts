import { q } from '../db';
import type { Project } from '../types';

interface VercelDeployment {
  uid: string;
  state: string;
  url: string;
  meta?: { githubCommitSha?: string };
  ready?: number;
  created?: number;
}

interface VercelListResp {
  deployments: VercelDeployment[];
}

async function vercelLatest(
  projectId: string,
  token: string,
  teamId?: string
): Promise<VercelDeployment | null> {
  const params = new URLSearchParams({ projectId, limit: '1' });
  if (teamId) params.set('teamId', teamId);
  const r = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    throw new Error(`Vercel ${r.status}: ${await r.text()}`);
  }
  const data = (await r.json()) as VercelListResp;
  return data.deployments[0] ?? null;
}

export async function pollAllDeploys(): Promise<{ polled: number; skipped: number; errors: string[] }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error('VERCEL_TOKEN is not set in env');
  }
  const teamId = process.env.VERCEL_TEAM_ID || undefined;

  const projects = await q<Project>(
    `select * from dev.projects
     where vercel_project_id is not null and state <> 'archived'`
  );

  let polled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of projects) {
    if (!p.vercel_project_id) {
      skipped++;
      continue;
    }
    try {
      const d = await vercelLatest(p.vercel_project_id, token, teamId);
      await q(
        `insert into dev.deployments
           (project_id, provider, state, url, commit_sha, deployed_at)
         values ($1,'vercel',$2,$3,$4,$5)`,
        [
          p.id,
          d?.state ?? null,
          d?.url ? `https://${d.url}` : null,
          d?.meta?.githubCommitSha ?? null,
          d?.ready ? new Date(d.ready).toISOString() : null,
        ]
      );
      polled++;
    } catch (err) {
      errors.push(`${p.slug}: ${(err as Error).message}`);
    }
  }

  return { polled, skipped, errors };
}
