// Deterministic checks that the tests an agent touched still mean something.
// Agents under pressure to make checks pass take the easy way when they can: delete or skip a
// test, loosen an assertion, special-case the test environment, or add a test that proves nothing.
import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACES } from './paths.mjs';
import { git, changedFiles, runChecks } from './workspace.mjs';

export const isTestFile = (p) => /(^|[/_.-])tests?([/_.-]|$)|\.spec\.|(^|\/)conftest\.py$/i.test(p);

// Files that agents load as instructions. A run that writes one could steer every later run.
const INSTRUCTION_FILES = new Set(['claude.md', 'agents.md', '.mcp.json', 'gemini.md', '.cursorrules']);
const INSTRUCTION_DIRS = ['.claude/', '.cursor/', '.github/'];

const ASSERTION = /\b(assert\w*|expect|should|self\.assert\w*|pytest\.raises|t\.(equal|deepEqual|ok|throws|match)\w*)\b/;
const SKIP = /@pytest\.mark\.(skip|xfail)|@unittest\.(skip|expectedFailure)|pytest\.(skip|xfail)\(|\b(it|test|describe)\.(skip|todo|only)\b|\bx(it|describe|test)\(|\bt\.(skip|todo)\(|\{\s*skip:\s*true/;
const TEST_ENV_SNIFF = /PYTEST_CURRENT_TEST|["']pytest["']\s+in\s+sys\.modules|NODE_TEST_CONTEXT|JEST_WORKER_ID|VITEST|process\.env\.NODE_ENV\s*===?\s*["']test["']/;

// Added and removed lines of one file's diff, without the +++/--- headers.
function diffLines(worktree, base, file) {
  const out = git(worktree, 'diff', '-U0', `${base}..HEAD`, '--', file).split('\n');
  return {
    added: out.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)),
    removed: out.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1)),
  };
}

// Problems that send an attempt back, plus assertion edits the reviewer should look at.
export function guard(repo, run, protectedPaths = []) {
  const prefixes = [...INSTRUCTION_DIRS, ...protectedPaths, ...(repo.protected ?? [])];
  const problems = [];
  const editedAssertions = [];
  for (const f of changedFiles(run.worktree, run.base)) {
    const hit = prefixes.find((p) => f.path === p || f.path.startsWith(p));
    if (hit) {
      problems.push(`${f.path} is under the protected path ${hit}`);
      continue;
    }
    if (INSTRUCTION_FILES.has(path.posix.basename(f.path).toLowerCase())) {
      problems.push(`${f.path} is an agent instruction file; later runs would read it as instructions`);
      continue;
    }
    const test = isTestFile(f.path);
    if (f.status === 'D') {
      if (test) problems.push(`${f.path} is a test file and was deleted`);
      continue;
    }
    const { added, removed } = diffLines(run.worktree, run.base, f.path);
    if (test) {
      const skips = added.filter((l) => SKIP.test(l));
      if (skips.length) problems.push(`${f.path} skips or narrows tests: ${skips.map((l) => l.trim()).join(' | ')}`);
      const lost = removed.filter((l) => ASSERTION.test(l)).length - added.filter((l) => ASSERTION.test(l)).length;
      if (lost > 0) problems.push(`${f.path} has ${lost} fewer assertion line(s) than before`);
      if (f.status === 'M') editedAssertions.push(...removed.filter((l) => ASSERTION.test(l)).map((l) => `${f.path}: - ${l.trim()}`));
    } else {
      const sniff = added.filter((l) => TEST_ENV_SNIFF.test(l));
      if (sniff.length) problems.push(`${f.path} checks whether it is running under tests: ${sniff.map((l) => l.trim()).join(' | ')}`);
    }
  }
  return { problems, editedAssertions };
}

// Fail-to-pass: put the agent's new and changed test files on the original code and run them.
// They should fail there. If they pass, they do not show that this change did anything.
export function failToPass(repo, run, sandbox = null) {
  const tests = changedFiles(run.worktree, run.base).filter((f) => f.status !== 'D' && isTestFile(f.path)).map((f) => f.path);
  if (!tests.length) return { outcome: 'none' };
  const dir = path.join(WORKSPACES, `${run.id}--base`);
  if (fs.existsSync(dir)) git(run.repo, 'worktree', 'remove', '--force', dir);
  git(run.repo, 'worktree', 'add', '--detach', dir, run.base);
  try {
    for (const t of tests) {
      fs.mkdirSync(path.dirname(path.join(dir, t)), { recursive: true });
      fs.writeFileSync(path.join(dir, t), git(run.worktree, 'show', `HEAD:${t}`) + '\n');
    }
    const quoted = tests.map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(' ');
    const commands = repo.testFiles ? [repo.testFiles.replaceAll('{files}', quoted)] : repo.verify;
    const r = runChecks(dir, commands, sandbox);
    return { outcome: r.ok ? 'pass_on_base' : 'fail_on_base', tests, log: r.log };
  } finally {
    git(run.repo, 'worktree', 'remove', '--force', dir);
  }
}
