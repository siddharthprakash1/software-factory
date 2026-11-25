import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { dockerPath, dockerArgs } from './sandbox.mjs';
import { WORKSPACES } from './paths.mjs';

export const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const tryGit = (cwd, ...args) => {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
};

export const tail = (s, n) => (s.length > n ? '...' + s.slice(-n) : s);

// Each run gets its own worktree and branch. With a remote, it starts from the freshly
// fetched upstream of the checked-out branch; otherwise from local HEAD.
export function createWorkspace(repo, id, fixedBase) {
  git(repo, 'rev-parse', '--git-dir'); // throws if not a git repo
  const baseBranch = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
  const hasRemote = tryGit(repo, 'remote', 'get-url', 'origin') && tryGit(repo, 'fetch', '-q', 'origin') !== null;
  const base = fixedBase ?? ((hasRemote && tryGit(repo, 'rev-parse', `origin/${baseBranch}`)) || git(repo, 'rev-parse', 'HEAD'));
  const worktree = path.join(WORKSPACES, id);
  const branch = `factory/${id}`;
  fs.mkdirSync(WORKSPACES, { recursive: true });
  git(repo, 'worktree', 'add', '-b', branch, worktree, base);
  return { worktree, branch, base, baseBranch };
}

// Commits whatever the agent changed. Returns false when there was nothing to commit.
export function commitAll(worktree, message) {
  git(worktree, 'add', '-A');
  if (!git(worktree, 'status', '--porcelain')) return false;
  const ident = [];
  if (!tryGit(worktree, 'config', 'user.name')) {
    ident.push('-c', 'user.name=software-factory', '-c', 'user.email=factory@localhost');
  }
  git(worktree, ...ident, 'commit', '-m', message);
  return true;
}

// Files changed since `base`, as [{ status: 'A'|'M'|'D'|..., path }].
export const changedFiles = (worktree, base) =>
  git(worktree, 'diff', '--name-status', `${base}..HEAD`)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status: status[0], path: rest.at(-1) };
    });

// Runs check commands in order and stops at the first failure. With a sandbox, each command runs
// inside the container: the tests execute code an agent just wrote.
export function runChecks(cwd, commands, sandbox = null) {
  if (sandbox) return runChecksInSandbox(cwd, commands, sandbox);
  let log = '';
  for (const cmd of commands) {
    try {
      const out = execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 15 * 60_000 });
      log += `$ ${cmd}\n${out}\n`;
    } catch (e) {
      log += `$ ${cmd}\n${e.stdout ?? ''}${e.stderr ?? ''}\n(exit ${e.status})\n`;
      return { ok: false, log, failed: cmd };
    }
  }
  return { ok: true, log };
}

function runChecksInSandbox(cwd, commands, sandbox) {
  const docker = dockerPath(sandbox.docker);
  if (!docker) return { ok: false, log: 'sandbox is enabled but docker is not available\n', failed: commands[0] ?? '(sandbox)' };
  let log = '';
  for (const cmd of commands) {
    const r = spawnSync(docker, dockerArgs(sandbox, cwd, ['sh', '-c', cmd]), { encoding: 'utf8', timeout: 15 * 60_000, windowsHide: true });
    log += `$ ${cmd}   (in sandbox)\n${r.stdout ?? ''}${r.stderr ?? ''}\n`;
    if (r.status !== 0) {
      log += `(exit ${r.status ?? r.error?.message})\n`;
      return { ok: false, log, failed: cmd };
    }
  }
  return { ok: true, log };
}
