import { git, tail } from './workspace.mjs';
import { writeRunFile } from './runs.mjs';
import { createPr } from './github.mjs';

function report(run) {
  return [
    `- Attempts: ${run.iteration}, cost: $${run.costUsd.toFixed(3)}`,
    `- Triage: ${run.triage.decision} / ${run.triage.complexity} - ${run.triage.reason}`,
    `- Review: ${run.review?.summary ?? ''}`,
    ...(run.uiCheck ? [`- Browser check: ${run.uiCheck.summary}`] : []),
    '',
    '## Changes',
    '```',
    git(run.worktree, 'diff', '--stat', `${run.base}..HEAD`),
    '```',
    '',
    '## Verification',
    '```',
    tail(run.verifyLog ?? '(no checks configured)', 3000),
    '```',
  ].join('\n');
}

// Writes report.md for a finished run and, when asked, pushes the branch and opens or updates the PR.
export function deliver(run) {
  const body = report(run);
  if (run.openPr) {
    git(run.worktree, 'push', '-q', '-u', 'origin', run.branch);
    if (!run.pr) {
      const closes = run.issue.number ? `Closes #${run.issue.number}\n\n` : '';
      const prBody = `${closes}Produced by the software factory (run \`${run.id}\`). Comment on this PR to have it revised.\n\n${body}`;
      run.pr = createPr(run.github, { head: run.branch, base: run.baseBranch, title: run.issue.title, body: prBody, cwd: run.worktree });
    }
  }
  const header = [
    `# ${run.issue.title}`,
    '',
    `- Run: ${run.id}`,
    `- Branch: \`${run.branch}\` in ${run.repo}`,
    ...(run.pr ? [`- PR: ${run.pr}`] : []),
  ].join('\n');
  const inspect = `\nInspect: \`git -C "${run.repo}" diff ${run.base.slice(0, 8)}..${run.branch}\`\n`;
  writeRunFile(run, 'report.md', `${header}\n${body}\n${inspect}`);
}
