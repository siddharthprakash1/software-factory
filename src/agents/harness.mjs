import { spawn } from 'node:child_process';

// Runs a process, feeds `input` on stdin, resolves with stdout/stderr/exit code.
function exec(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    // Let a nested agent start cleanly when the factory itself is launched from an agent session.
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    const child = spawn(command, args, { cwd, env, windowsHide: true });
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

async function runClaude({ model, tools, write, prompt, cwd, timeoutMs }) {
  const args = ['-p', '--output-format', 'json', '--model', model];
  if (tools?.length) args.push('--allowedTools', tools.join(','));
  if (write) args.push('--permission-mode', 'acceptEdits');
  // FACTORY_CLAUDE points at a node script that stands in for the CLI (used by the tests).
  const fake = process.env.FACTORY_CLAUDE;
  const r = await exec(fake ? process.execPath : 'claude', fake ? [fake, ...args] : args, { cwd, input: prompt, timeoutMs });
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

export async function runAgent(config, stageDef, { model, prompt, cwd }) {
  const timeoutMs = (config.agentTimeoutMin ?? 20) * 60_000;
  const started = Date.now();
  const name = stageDef.harness ?? 'claude';
  const opts = { model, tools: stageDef.tools, write: stageDef.write, prompt, cwd, timeoutMs };
  let result;
  if (name === 'claude') result = await runClaude(opts);
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
