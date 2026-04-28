import { supabaseServer } from '../supabase/server';
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

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .not('vercel_project_id', 'is', null)
    .neq('state', 'archived');
  if (error) throw error;
  const projects = (data ?? []) as Project[];

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
      const { error: insErr } = await sb.from('deployments').insert({
        project_id: p.id,
        provider: 'vercel',
        state: d?.state ?? null,
        url: d?.url ? `https://${d.url}` : null,
        commit_sha: d?.meta?.githubCommitSha ?? null,
        deployed_at: d?.ready ? new Date(d.ready).toISOString() : null,
      });
      if (insErr) throw insErr;
      polled++;
    } catch (err) {
      errors.push(`${p.slug}: ${(err as Error).message}`);
    }
  }

  return { polled, skipped, errors };
}
