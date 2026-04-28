import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { supabaseServer } from '../supabase/server';
import type { Project } from '../types';

const exec = promisify(execFile);

interface FsState {
  current_branch: string | null;
  is_dirty: boolean | null;
  uncommitted_files: number | null;
  last_modified_at: string | null;
}

async function inspectRepo(localPath: string): Promise<FsState> {
  const gitDir = path.join(localPath, '.git');
  let isGit = false;
  try {
    await stat(gitDir);
    isGit = true;
  } catch {
    /* not a repo */
  }

  if (!isGit) {
    let last: string | null = null;
    try {
      const s = await stat(localPath);
      last = s.mtime.toISOString();
    } catch {
      /* missing path */
    }
    return {
      current_branch: null,
      is_dirty: null,
      uncommitted_files: null,
      last_modified_at: last,
    };
  }

  const branch = (
    await exec('git', ['-C', localPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
  ).stdout.trim();

  const status = (
    await exec('git', ['-C', localPath, 'status', '--porcelain'])
  ).stdout
    .split('\n')
    .filter(Boolean);

  let last: string | null = null;
  try {
    const s = await stat(localPath);
    last = s.mtime.toISOString();
  } catch {
    /* ignore */
  }

  return {
    current_branch: branch,
    is_dirty: status.length > 0,
    uncommitted_files: status.length,
    last_modified_at: last,
  };
}

export async function scanAllProjects(): Promise<{ scanned: number; skipped: number; errors: string[] }> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .not('local_path', 'is', null)
    .neq('state', 'archived');
  if (error) throw error;
  const projects = (data ?? []) as Project[];

  let scanned = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of projects) {
    if (!p.local_path) {
      skipped++;
      continue;
    }
    try {
      const result = await inspectRepo(p.local_path);
      const { error: insErr } = await sb.from('fs_snapshots').insert({
        project_id: p.id,
        ...result,
      });
      if (insErr) throw insErr;
      scanned++;
    } catch (err) {
      errors.push(`${p.slug} (${p.local_path}): ${(err as Error).message}`);
    }
  }

  return { scanned, skipped, errors };
}
