import { comment, prNumber } from './github.mjs';
import { readRunFile } from './runs.mjs';

// Reports a run's outcome on its GitHub issue (and PR). Runs started from a local file stay silent.
export function notify(run) {
  const { github, issue } = run;
  if (!github || !issue.number) return;
  const cost = `_Run \`${run.id}\`, cost so far $${run.costUsd.toFixed(2)}._`;

  if (run.status === 'parked') {
    comment(github, issue.number, `**Factory: parked.** ${run.note}\n\nReply on this issue with the missing details and it will be triaged again.\n\n${cost}`);
  } else if (run.status === 'awaiting_spec_approval') {
    const spec = readRunFile(run, 'spec.md');
    comment(github, issue.number, `**Factory: this needs a spec before any code.** Reply to approve it, or with the changes you want.\n\n---\n\n${spec}\n\n---\n${cost}`);
  } else if (run.status === 'needs_human') {
    comment(github, issue.number, `**Factory: stuck, needs a person.**\n\n${run.note}\n\nReply with guidance to have it try again.\n\n${cost}`);
  } else if (run.status === 'ready_for_review' && run.pr) {
    const revised = run.notifiedPr;
    if (!revised) comment(github, issue.number, `**Factory: pull request ready.** ${run.pr}\n\n${cost}`);
    else comment(github, prNumber(run.pr), `**Factory: revised.** ${run.review?.summary ?? ''}\n\n${cost}`);
    run.notifiedPr = true;
  }
}
