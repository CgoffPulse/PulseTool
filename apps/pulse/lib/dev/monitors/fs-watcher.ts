import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { q } from '../../db';
import type { MonitoredProject } from '../types';

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
  const projects = await q<MonitoredProject>(
    `select p.id, p.name, p.slug, p.state::text as state,
            p.summary, p.current_focus,
            p.github_repo, p.local_path, p.vercel_project_id,
            p.archived_at, p.updated_at
       from command.projects p
      where p.kind = 'internal_build'
        and p.local_path is not null
        and p.state::text <> 'archived'`
  );

  let scanned = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of projects) {
    if (!p.local_path) {
      skipped++;
      continue;
    }
    try {
      const r = await inspectRepo(p.local_path);
      await q(
        `insert into dev.fs_snapshots
           (project_id, current_branch, is_dirty, uncommitted_files, last_modified_at)
         values ($1,$2,$3,$4,$5)`,
        [p.id, r.current_branch, r.is_dirty, r.uncommitted_files, r.last_modified_at]
      );
      scanned++;
    } catch (err) {
      errors.push(`${p.slug} (${p.local_path}): ${(err as Error).message}`);
    }
  }

  return { scanned, skipped, errors };
}
