/**
 * Project autodiscovery — walk a root directory one level deep, find git
 * repositories, infer their GitHub remote, and report back the candidates so
 * the user can bulk-import them as `dev.projects` rows.
 *
 * Server-only. Uses `node:fs/promises` and `node:child_process` directly so
 * we never recurse beyond one level (the user's `~/Developer` contains a
 * monorepo with many nested git directories we don't care about here).
 */
import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { q } from './db';
import { slugify } from './utils';

const exec = promisify(execFile);

export interface DiscoveredProject {
  name: string;
  slug: string;
  local_path: string;
  github_repo: string | null;
  current_branch: string | null;
  is_dirty: boolean | null;
  uncommitted_files: number | null;
  last_modified_at: string | null;
  already_imported: boolean;
  error?: string;
}

/**
 * Parse a remote URL like:
 *   - git@github.com:owner/name.git
 *   - https://github.com/owner/name.git
 *   - https://github.com/owner/name
 *   - ssh://git@github.com/owner/name.git
 * into a canonical `owner/name`. Returns null for non-GitHub or unparseable.
 */
export function parseGitHubRemote(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // SSH form: git@github.com:owner/name(.git)?
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;

  // ssh:// or https:// or git:// form pointing at github.com
  const proto = trimmed.match(
    /^(?:https?|ssh|git):\/\/(?:[^@]+@)?github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i
  );
  if (proto) return `${proto[1]}/${proto[2]}`;

  return null;
}

/**
 * Run a git command, returning stdout (trimmed) or null on any failure.
 * We never let a single bad repo crash discovery — discovery is best-effort.
 */
async function gitOrNull(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['-C', cwd, ...args], {
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

interface GitState {
  github_repo: string | null;
  current_branch: string | null;
  is_dirty: boolean | null;
  uncommitted_files: number | null;
}

async function inspectGitRepo(localPath: string): Promise<GitState> {
  const remote = await gitOrNull(localPath, ['config', '--get', 'remote.origin.url']);
  const branch = await gitOrNull(localPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = await gitOrNull(localPath, ['status', '--porcelain']);

  let uncommitted: number | null = null;
  let dirty: boolean | null = null;
  if (status !== null) {
    const lines = status.split('\n').filter(Boolean);
    uncommitted = lines.length;
    dirty = lines.length > 0;
  }

  return {
    github_repo: parseGitHubRemote(remote),
    current_branch: branch || null,
    is_dirty: dirty,
    uncommitted_files: uncommitted,
  };
}

interface ExistingRow {
  local_path: string | null;
  github_repo: string | null;
}

async function loadExistingProjectKeys(): Promise<{
  paths: Set<string>;
  repos: Set<string>;
}> {
  const rows = await q<ExistingRow>(
    `select local_path, github_repo from dev.projects`
  );
  const paths = new Set<string>();
  const repos = new Set<string>();
  for (const r of rows) {
    if (r.local_path) paths.add(r.local_path);
    if (r.github_repo) repos.add(r.github_repo.toLowerCase());
  }
  return { paths, repos };
}

/**
 * Walk `root` exactly one level deep, return the candidates we'd want to
 * import. Sorted: not-yet-imported first, then by `last_modified_at` desc.
 */
export async function discoverProjects(root: string): Promise<DiscoveredProject[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `Could not read DEV_PROJECTS_ROOT (${root}): ${(err as Error).message}`
    );
  }

  const existing = await loadExistingProjectKeys();
  const out: DiscoveredProject[] = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.')) continue;

    const localPath = path.join(root, ent.name);
    const gitDir = path.join(localPath, '.git');

    try {
      await stat(gitDir);
    } catch {
      continue; // not a git repo at this level
    }

    let lastModified: string | null = null;
    try {
      const s = await stat(localPath);
      lastModified = s.mtime.toISOString();
    } catch {
      /* ignore */
    }

    let git: GitState = {
      github_repo: null,
      current_branch: null,
      is_dirty: null,
      uncommitted_files: null,
    };
    let errorMsg: string | undefined;
    try {
      git = await inspectGitRepo(localPath);
    } catch (err) {
      errorMsg = (err as Error).message;
    }

    const name = ent.name;
    const slug = slugify(name);
    const alreadyImported =
      existing.paths.has(localPath) ||
      (git.github_repo
        ? existing.repos.has(git.github_repo.toLowerCase())
        : false);

    out.push({
      name,
      slug,
      local_path: localPath,
      github_repo: git.github_repo,
      current_branch: git.current_branch,
      is_dirty: git.is_dirty,
      uncommitted_files: git.uncommitted_files,
      last_modified_at: lastModified,
      already_imported: alreadyImported,
      error: errorMsg,
    });
  }

  out.sort((a, b) => {
    if (a.already_imported !== b.already_imported) {
      return a.already_imported ? 1 : -1;
    }
    const at = a.last_modified_at ? new Date(a.last_modified_at).getTime() : 0;
    const bt = b.last_modified_at ? new Date(b.last_modified_at).getTime() : 0;
    return bt - at;
  });

  return out;
}
