// A risk rating for a delivered change, computed in plain code from facts the run already has.
// No agent is asked: the rating decides whether a PR may be merged without a person, and that
// decision must not be talked into by the change itself.
//
// "low" needs every one of these: a low-complexity issue, delivered on the first attempt without
// human steering, small, no risky paths, tests that fail on the original code, and nothing the
// reviewer or the test checks flagged. Anything else is "medium" or "high", with the reasons.
import { git, changedFiles } from './workspace.mjs';

const DEFAULT_RISKY = [
  /(^|\/)(migrations?|schema)\b/i,
  /(^|\/)(auth|security|crypto|secrets?|permissions?)\b/i,
  /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements[^/]*\.txt|pyproject\.toml|uv\.lock|poetry\.lock|go\.(mod|sum)|Cargo\.(toml|lock)|Dockerfile)$/i,
  /\.(sql|tf|ya?ml)$/i,
];

export function assessRisk(run, repo = {}) {
  const files = changedFiles(run.worktree, run.base);
  const numstat = git(run.worktree, 'diff', '--numstat', `${run.base}..HEAD`)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
  const lines = numstat.reduce((sum, [a, d]) => sum + (Number(a) || 0) + (Number(d) || 0), 0);
  const limits = { lines: 60, files: 4, ...(repo.risk ?? {}) };
  const risky = [...DEFAULT_RISKY, ...(repo.risk?.paths ?? []).map((p) => new RegExp(p))];
  const f2p = run.events.findLast((e) => e.stage === 'fail_to_pass')?.outcome ?? '';

  const high = [];
  const medium = [];
  const riskyFiles = files.filter((f) => risky.some((r) => r.test(f.path))).map((f) => f.path);
  if (riskyFiles.length) high.push(`touches sensitive paths: ${riskyFiles.join(', ')}`);
  if (run.triage?.complexity === 'high') high.push('triage rated it high complexity');
  if (lines > limits.lines * 4) high.push(`${lines} lines changed`);
  if (run.triage?.complexity === 'medium') medium.push('triage rated it medium complexity');
  if (lines > limits.lines && lines <= limits.lines * 4) medium.push(`${lines} lines changed (low allows ${limits.lines})`);
  if (files.length > limits.files) medium.push(`${files.length} files changed (low allows ${limits.files})`);
  if (run.iteration > 1) medium.push(`needed ${run.iteration} attempts`);
  if (run.events.some((e) => e.stage === 'human')) medium.push('a person steered it');
  if (run.scopeNotes?.length) medium.push('the reviewer saw changes beyond the issue');
  if (run.testNote) medium.push(run.testNote);
  else if (f2p !== 'new tests fail on the original code') medium.push('no test shown to fail without the change');
  if (run.editedAssertions?.length) medium.push(`${run.editedAssertions.length} existing assertion line(s) changed`);
  if (run.uiCheck && run.uiCheck.verdict !== 'pass') medium.push('the browser check did not pass');

  const level = high.length ? 'high' : medium.length ? 'medium' : 'low';
  return { level, reasons: [...high, ...medium], lines, files: files.length };
}
