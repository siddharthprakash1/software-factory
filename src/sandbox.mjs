// Runs agents and test commands inside a throwaway Docker container instead of on the host.
// The container sees only the run's worktree (and the git data that worktree needs), a dedicated
// model token, and a shared package cache. It has no host home directory, no login files, no GitHub
// credentials, no capabilities, and limits on memory, CPU and processes.
// Its network is not restricted: the agent needs the model API, and so do package installs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CANDIDATES = [
  'docker',
  path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
  path.join(process.env.ProgramFiles ?? '', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
];

let found;
export function dockerPath(configured) {
  if (configured) return configured;
  if (found !== undefined) return found;
  found = null;
  for (const c of CANDIDATES) {
    try {
      execFileSync(c, ['version', '--format', '{{.Server.Version}}'], { stdio: 'ignore', timeout: 20_000 });
      found = c;
      break;
    } catch {}
  }
  return found;
}

// Is sandboxing on for this stage? Tests use a fake claude and never sandbox.
export function sandboxFor(config, stageDef) {
  const s = config.sandbox;
  if (!s?.enabled || process.env.FACTORY_CLAUDE) return null;
  if (stageDef && stageDef.sandbox === false) return null;
  return s;
}

// A git worktree's .git is a file pointing at <repo>/.git/worktrees/<id>, a host path the
// container cannot resolve. Mount the repository's .git and point git at it explicitly.
function gitMounts(cwd) {
  const dotGit = path.join(cwd, '.git');
  if (!fs.existsSync(dotGit) || fs.statSync(dotGit).isDirectory()) return { mounts: [], env: {} };
  const gitdir = path.resolve(cwd, fs.readFileSync(dotGit, 'utf8').match(/gitdir:\s*(.+)/)[1].trim());
  const common = path.resolve(gitdir, fs.readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim());
  const rel = path.relative(common, gitdir).split(path.sep).join('/');
  return {
    mounts: ['-v', `${common}:/repo.git`],
    env: { GIT_DIR: `/repo.git/${rel}`, GIT_WORK_TREE: '/work' },
  };
}

// Model access inside the container. Never the host's login file: it holds a refresh token
// (a refresh inside the container invalidates the host's login) and the keys of every other
// connected service. Instead a dedicated token made with `claude setup-token`, or an API key,
// passed by name so its value never appears on a command line.
export const LOGIN_VARS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'];
export const sandboxLogin = (env = process.env) => LOGIN_VARS.filter((k) => env[k]);

// Match the host's line-ending setting, or git in the container sees every file as changed.
let autocrlf;
function hostAutocrlf() {
  if (autocrlf === undefined) {
    try {
      autocrlf = execFileSync('git', ['config', '--get', 'core.autocrlf'], { encoding: 'utf8' }).trim() || null;
    } catch {
      autocrlf = null;
    }
  }
  return autocrlf;
}

// Arguments for `docker run` that execute `command` in the sandbox with `cwd` mounted at /work.
export function dockerArgs(sandbox, cwd, command, { env = {}, login = false } = {}) {
  const git = gitMounts(cwd);
  const allEnv = {
    ...git.env,
    // The mounted repository is owned by another user id; tell git that is fine.
    GIT_CONFIG_COUNT: '3',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: '*',
    GIT_CONFIG_KEY_1: 'credential.helper',
    GIT_CONFIG_VALUE_1: '',
    GIT_CONFIG_KEY_2: 'core.autocrlf',
    GIT_CONFIG_VALUE_2: hostAutocrlf() ?? 'false',
    // Keep Linux-only files out of the worktree: a uv virtualenv and npm's .bin links are
    // symlinks the host (Windows) cannot delete. The venv lives in the container and is rebuilt
    // from the shared cache each time.
    UV_PROJECT_ENVIRONMENT: '/home/node/venv',
    NPM_CONFIG_BIN_LINKS: 'false',
    ...env,
  };
  return [
    'run', '--rm', '-i',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--pids-limit', String(sandbox.pids ?? 512),
    '--memory', sandbox.memory ?? '4g',
    '--cpus', String(sandbox.cpus ?? 4),
    '-v', `${path.resolve(cwd)}:/work`,
    ...git.mounts,
    '-v', `${sandbox.cacheVolume ?? 'software-factory-cache'}:/home/node/.cache`,
    ...(login ? sandboxLogin().flatMap((k) => ['-e', k]) : []),
    ...Object.entries(allEnv).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    '-w', '/work',
    sandbox.image ?? 'software-factory-agent',
    ...command,
  ];
}
