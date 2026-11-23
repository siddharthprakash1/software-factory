import { execFileSync } from 'node:child_process';
import { git, tail } from './workspace.mjs';
import { writeRunFile } from './runs.mjs';

// Writes report.md for a finished run and, when asked, pushes the branch and opens a PR.
export function deliver(run) {
  const lines = [
    `# ${run.issue.title}`,
    '',
    `- Run: ${run.id}`,
    `- Branch: \`${run.branch}\` in ${run.repo}`,
    `- Attempts: ${run.iteration}`,
    `- Cost: $${run.costUsd.toFixed(3)}`,
    `- Triage: ${run.triage.decision} / ${run.triage.complexity} - ${run.triage.reason}`,
    `- Review: ${run.review?.summary ?? ''}`,
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
    '',
    `Inspect: \`git -C "${run.repo}" diff ${run.base.slice(0, 8)}..${run.branch}\``,
  ];
  if (run.openPr) {
    git(run.worktree, 'push', '-u', 'origin', run.branch);
    const body = lines.join('\n') + (run.issue.url ? `\n\nIssue: ${run.issue.url}` : '');
    run.pr = execFileSync('gh', ['pr', 'create', '--title', run.issue.title, '--body', body, '--head', run.branch], {
      cwd: run.worktree,
      encoding: 'utf8',
    }).trim();
    lines.push('', `PR: ${run.pr}`);
  }
  writeRunFile(run, 'report.md', lines.join('\n') + '\n');
}
