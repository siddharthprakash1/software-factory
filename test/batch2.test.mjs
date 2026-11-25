import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { world, reply } from './helpers.mjs';
import { dockerArgs } from '../src/sandbox.mjs';

const happy = { triage: [reply.automate()], implement: [reply.write('fixed\n')], review: [reply.approve()], learn: [{ text: 'NO_CHANGE' }] };
// A change that also adds a test which fails on the original code: the shape of a low-risk PR.
const REAL_TEST = "import fs from 'node:fs';\nif (!fs.readFileSync('app.txt', 'utf8').includes('fixed')) process.exit(1);\n";
const lowRisk = { ...happy, implement: [{ text: 'done', write: { 'app.txt': 'fixed\n', 'test/fixed.test.mjs': REAL_TEST } }] };

const setRepo = (w, fields) => {
  const cfg = path.join(w.dir, 'factory.config.mjs');
  const extra = Object.entries(fields).map(([k, v]) => `"${k}": ${JSON.stringify(v)},\n      `).join('');
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('"verify"', `${extra}"verify"`));
};
const prOf = (w) => Object.values(w.github.state().items).find((i) => i.kind === 'pr');

test('a small first-attempt change with a real test is rated low risk and labelled', (t) => {
  const w = world(lowRisk);
  t.after(w.cleanup);
  setRepo(w, { testFiles: 'node {files}' });
  w.github.addIssue('Fix the app', 'Make app.txt say fixed.');
  w.factory('poll');
  const run = w.run();
  assert.equal(run.risk.level, 'low', run.risk.reasons.join('; '));
  assert.ok(prOf(w).labels.includes('risk:low'));
  assert.match(prOf(w).body, /Risk: \*\*low\*\*/);
  assert.ok(!prOf(w).autoMerge, 'no auto-merge unless the repository opts in');
});

test('a change without a test that proves it is not low risk', (t) => {
  const w = world(happy);
  t.after(w.cleanup);
  w.github.addIssue('Fix the app', 'Make app.txt say fixed.');
  w.factory('poll');
  assert.equal(w.run().risk.level, 'medium');
  assert.ok(w.run().risk.reasons.some((r) => /No tests were added/.test(r)));
});

test('auto-merge is enabled only when the repository opts in and the risk is low', (t) => {
  const w = world(lowRisk);
  t.after(w.cleanup);
  setRepo(w, { testFiles: 'node {files}', autoMerge: true });
  w.github.addIssue('Fix the app', 'Make app.txt say fixed.');
  w.factory('poll');
  assert.equal(prOf(w).autoMerge, true);
  assert.ok(prOf(w).labels.includes('factory:auto-merge'));
  assert.equal(w.run().autoMerge, true);
});

test('sensitive paths are high risk and never auto-merged', (t) => {
  const w = world({ ...lowRisk, implement: [{ text: 'done', write: { 'app.txt': 'fixed\n', 'test/fixed.test.mjs': REAL_TEST, 'package.json': '{}\n' } }] });
  t.after(w.cleanup);
  setRepo(w, { testFiles: 'node {files}', autoMerge: true });
  w.github.addIssue('Fix the app', 'Make app.txt say fixed.');
  w.factory('poll');
  assert.equal(w.run().risk.level, 'high');
  assert.ok(!prOf(w).autoMerge);
});

test('closed PRs keep the reason a person gave, and merges and reverts are counted', (t) => {
  const w = world(happy);
  t.after(w.cleanup);
  const first = w.github.addIssue('Fix the app', 'Make app.txt say fixed.');
  w.factory('poll');
  const pr1 = Number(Object.entries(w.github.state().items).find(([, i]) => i.kind === 'pr')[0]);
  w.github.addComment(pr1, 'Closing: we decided not to change app.txt after all.');
  w.github.update((s) => (s.items[pr1].state = 'CLOSED'));
  w.factory('poll');
  assert.equal(w.runs().find((r) => r.issue.number === first).status, 'closed');
  assert.match(w.runs().find((r) => r.issue.number === first).closedReason, /decided not to change/);

  w.github.addIssue('Fix the app again', 'Make app.txt say fixed.');
  w.factory('poll');
  w.github.update((s) => {
    const pr = Object.values(s.items).find((i) => i.kind === 'pr' && i.title === 'Fix the app again');
    pr.state = 'MERGED';
    pr.mergedAt = new Date().toISOString();
  });
  w.factory('poll');
  w.github.update((s) => (s.items[s.next++] = { kind: 'pr', state: 'MERGED', title: 'Revert "Fix the app again"', labels: [], comments: [] }));
  w.factory('poll');
  assert.equal(w.runs().find((r) => r.issue.title === 'Fix the app again').reverted, true);

  const { out } = w.factory('metrics');
  assert.match(out, /decided by a person: 2\s+merge rate: 50%\s+reverted: 1/);
  assert.match(out, /1 x Closing: we decided not to change app\.txt after all\./);
});

test('the sandbox mounts only the worktree and passes model access by name', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'sb-'));
  const args = dockerArgs({ image: 'img' }, dir, ['claude', '-p'], { login: true });
  const mounts = args.flatMap((a, i) => (args[i - 1] === '-v' ? [a] : []));
  assert.equal(mounts.length, 2, mounts.join(' | ')); // the worktree and the package cache
  assert.ok(mounts.some((m) => m.endsWith(':/work')));
  assert.ok(!args.some((a) => /credentials|\.claude\b/.test(a)), 'no login file is mounted');
  assert.ok(args.includes('--cap-drop') && args.includes('no-new-privileges'));
  for (const a of args.filter((a, i) => args[i - 1] === '-e')) {
    if (/^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)/.test(a)) assert.ok(!a.includes('='), 'token passed by name, not value');
  }
  assert.deepEqual(args.slice(-3), ['img', 'claude', '-p']);
  fs.rmSync(dir, { recursive: true });
});
