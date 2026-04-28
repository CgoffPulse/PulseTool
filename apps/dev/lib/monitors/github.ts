import { supabaseServer } from '../supabase/server';
import type { Project } from '../types';

interface GitHubCommit {
  sha: string;
  commit: {
    author?: { date?: string };
    message?: string;
  };
}

interface GitHubRepo {
  default_branch: string;
}

interface GitHubSearchResp {
  total_count: number;
}

const GH_API = 'https://api.github.com';

async function gh<T>(path: string, token: string): Promise<T> {
  const r = await fetch(`${GH_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!r.ok) {
    throw new Error(`GitHub ${path} ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as T;
}

interface PolledRepo {
  default_branch: string | null;
  last_commit_sha: string | null;
  last_commit_at: string | null;
  last_commit_message: string | null;
  open_pr_count: number | null;
  open_issue_count: number | null;
}

export async function pollOne(repo: string, token: string): Promise<PolledRepo> {
  const meta = await gh<GitHubRepo>(`/repos/${repo}`, token);
  const branch = meta.default_branch;

  const commits = await gh<GitHubCommit[]>(
    `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`,
    token
  );
  const last = commits[0] ?? null;

  // Search APIs include both PRs (issues) and issues; split via type:pr / type:issue
  const prSearch = await gh<GitHubSearchResp>(
    `/search/issues?q=${encodeURIComponent(`repo:${repo} is:pr is:open`)}`,
    token
  );
  const issueSearch = await gh<GitHubSearchResp>(
    `/search/issues?q=${encodeURIComponent(`repo:${repo} is:issue is:open`)}`,
    token
  );

  return {
    default_branch: branch,
    last_commit_sha: last?.sha ?? null,
    last_commit_at: last?.commit?.author?.date ?? null,
    last_commit_message: last?.commit?.message?.split('\n')[0] ?? null,
    open_pr_count: prSearch.total_count,
    open_issue_count: issueSearch.total_count,
  };
}

export async function pollAllProjects(): Promise<{ polled: number; skipped: number; errors: string[] }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set in env');
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .not('github_repo', 'is', null)
    .neq('state', 'archived');
  if (error) throw error;
  const projects = (data ?? []) as Project[];

  let polled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of projects) {
    if (!p.github_repo) {
      skipped++;
      continue;
    }
    try {
      const result = await pollOne(p.github_repo, token);
      const { error: insErr } = await sb.from('repo_activity').insert({
        project_id: p.id,
        ...result,
      });
      if (insErr) throw insErr;
      polled++;
    } catch (err) {
      errors.push(`${p.slug} (${p.github_repo}): ${(err as Error).message}`);
    }
  }

  return { polled, skipped, errors };
}
