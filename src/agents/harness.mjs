import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { sandboxFor, dockerPath, dockerArgs, sandboxLogin } from '../sandbox.mjs';

// Agents never need GitHub credentials: the factory itself pushes and comments. So the agent's
// environment drops tokens, points gh at an empty config, and clears git's credential helpers.
// An agent tricked by an issue into "git push" or "gh api" then has nothing to authenticate with.
const EMPTY_GH = path.join(os.tmpdir(), 'software-factory-empty-gh');
const SECRET = /TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|CREDENTIAL/i;
const KEEP = new Set(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']); // the agent's own model access
export function agentEnv(base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (KEEP.has(k) || !SECRET.test(k)) env[k] = v;
  // Let a nested agent start cleanly when the factory itself is launched from an agent session.
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  fs.mkdirSync(EMPTY_GH, { recursive: true });
  return {
    ...env,
    GH_CONFIG_DIR: EMPTY_GH,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
  };
}

// Runs a process, feeds `input` on stdin, resolves with stdout/stderr/exit code.
function exec(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: agentEnv(), windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err), timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// Older Claude Code versions have known prompt-injection fixes missing (for example 2.1.163).
const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return true;
};
let versionError;
function checkVersion(min) {
  if (!min || process.env.FACTORY_CLAUDE) return null;
  if (versionError === undefined) {
    try {
      const v = execFileSync('claude', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).match(/\d+\.\d+\.\d+/)?.[0];
      versionError = v && newer(v, min) ? null : `Claude Code ${v ?? '(unknown version)'} is older than the minimum ${min}; update it with: claude update`;
    } catch (e) {
      versionError = `could not run claude --version: ${e.message}`;
    }
  }
  return versionError;
}

async function runClaude({ model, tools, write, prompt, cwd, timeoutMs, maxBudgetUsd, sandbox }) {
  const args = ['-p', '--output-format', 'json', '--model', model];
  if (maxBudgetUsd != null) args.push('--max-budget-usd', String(Math.max(0.01, Number(maxBudgetUsd.toFixed(2)))));
  if (tools?.length) args.push('--allowedTools', tools.join(','));
  if (write) args.push('--permission-mode', 'acceptEdits');
  // FACTORY_CLAUDE points at a node script that stands in for the CLI (used by the tests).
  const fake = process.env.FACTORY_CLAUDE;
  let command = fake ? process.execPath : 'claude';
  let argv = fake ? [fake, ...args] : args;
  if (sandbox) {
    command = dockerPath(sandbox.docker);
    if (!command) return { ok: false, text: '', error: 'sandbox is enabled but docker is not available; start Docker Desktop or set sandbox.enabled to false', costUsd: 0 };
    if (!sandboxLogin().length) {
      return { ok: false, text: '', error: 'the sandbox needs its own model access: run `claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN to the token it prints (or set ANTHROPIC_API_KEY)', costUsd: 0 };
    }
    argv = dockerArgs(sandbox, cwd, ['claude', ...args], { login: true });
  }
  const r = await exec(command, argv, { cwd, input: prompt, timeoutMs });
  if (r.timedOut) return { ok: false, text: '', error: 'agent timed out', costUsd: 0 };
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    return { ok: false, text: r.stdout, error: r.stderr || `exit ${r.code}`, costUsd: 0 };
  }
  return {
    ok: !out.is_error,
    text: out.result ?? '',
    error: out.is_error ? String(out.result ?? out.subtype ?? 'agent error') : null,
    costUsd: out.total_cost_usd ?? 0,
    tokensIn:
      (out.usage?.input_tokens ?? 0) +
      (out.usage?.cache_creation_input_tokens ?? 0) +
      (out.usage?.cache_read_input_tokens ?? 0),
    tokensOut: out.usage?.output_tokens ?? 0,
    sessionId: out.session_id,
  };
}

// Generic harness: any CLI that takes the prompt on stdin and prints its answer. Cost is unknown.
async function runCommand(def, { model, prompt, cwd, timeoutMs }) {
  const args = (def.args ?? []).map((a) => a.replaceAll('{model}', model));
  const r = await exec(def.command, args, { cwd, input: prompt, timeoutMs });
  const ok = r.code === 0 && !r.timedOut;
  return { ok, text: r.stdout, error: ok ? null : r.stderr || `exit ${r.code}`, costUsd: 0 };
}

export async function runAgent(config, stageDef, { model, prompt, cwd, remainingUsd }) {
  const timeoutMs = (config.agentTimeoutMin ?? 20) * 60_000;
  const started = Date.now();
  const name = stageDef.harness ?? 'claude';
  // A hard dollar cap on each agent call: the smaller of the per-call limit and what the run has left.
  const caps = [config.agentBudgetUsd, remainingUsd].filter((v) => v != null);
  const maxBudgetUsd = caps.length ? Math.min(...caps) : null;
  const opts = { model, tools: stageDef.tools, write: stageDef.write, prompt, cwd, timeoutMs, maxBudgetUsd, sandbox: sandboxFor(config, stageDef) };
  let result;
  // In the sandbox, the container's own claude runs; its version is fixed when the image is built.
  const tooOld = name === 'claude' && !opts.sandbox ? checkVersion(config.minClaudeVersion) : null;
  if (tooOld) result = { ok: false, text: '', error: tooOld, costUsd: 0 };
  else if (name === 'claude') result = await runClaude(opts);
  else if (config.harnesses?.[name]) result = await runCommand(config.harnesses[name], opts);
  else result = { ok: false, text: '', error: `unknown harness "${name}"`, costUsd: 0 };
  return { ...result, harness: name, model, durationMs: Date.now() - started };
}

// Agents end their answer with a fenced ```json block; pull out the last one.
export function parseJson(text) {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = blocks.length ? blocks.reverse() : [text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {}
  }
  return null;
}
