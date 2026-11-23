import { spawn, execFileSync } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killTree(child) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {}
}

// Starts the app from the worktree, waits until its URL answers, runs `fn`, then stops the app.
export async function withServer(ui, cwd, fn) {
  const child = spawn(ui.start, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  let exited = false;
  child.on('exit', () => (exited = true));
  try {
    const deadline = Date.now() + (ui.startTimeoutSec ?? 90) * 1000;
    for (;;) {
      if (exited) throw new Error(`\`${ui.start}\` exited before serving ${ui.url}:\n${log.slice(-2000)}`);
      try {
        const res = await fetch(ui.url, { signal: AbortSignal.timeout(3000) });
        if (res.status < 500) break;
      } catch {}
      if (Date.now() > deadline) throw new Error(`${ui.url} did not respond in time:\n${log.slice(-2000)}`);
      await sleep(1000);
    }
    return await fn();
  } finally {
    killTree(child);
  }
}
