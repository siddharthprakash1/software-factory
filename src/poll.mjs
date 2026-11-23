import { listRuns, saveRun, record } from './runs.mjs';
import { startRun, execute, resume } from './pipeline.mjs';
import { listLabeledIssues, humanCommentsSince, prState, prNumber } from './github.mjs';

const WAITING = ['parked', 'awaiting_spec_approval', 'needs_human', 'ready_for_review'];

// One pass over GitHub: start runs for newly labelled issues, feed new human comments back
// into waiting runs, and close out runs whose PR was merged or closed.
export async function pollOnce(config) {
  let acted = 0;

  for (const run of listRuns().filter((r) => r.github && r.issue.number && WAITING.includes(r.status))) {
    try {
      const pr = run.pr ? prNumber(run.pr) : null;
      if (pr) {
        const state = prState(run.github, pr);
        if (state !== 'OPEN') {
          run.status = state === 'MERGED' ? 'merged' : 'closed';
          run.note = `${run.pr} was ${run.status}`;
          record(run, 'human', `pr ${run.status}`);
          acted++;
          continue;
        }
      }
      const comments = [
        ...humanCommentsSince(run.github, run.issue.number, run.lastSeenAt),
        ...(pr ? humanCommentsSince(run.github, pr, run.lastSeenAt, { isPr: true }) : []),
      ].sort((a, b) => a.at.localeCompare(b.at));
      if (!comments.length) continue;
      console.log(`\n${run.id}: ${comments.length} new comment(s), resuming`);
      run.lastSeenAt = comments.at(-1).at;
      saveRun(run);
      await resume(config, run.id, { feedback: comments.map((c) => c.body).join('\n\n') });
      acted++;
    } catch (e) {
      console.error(`${run.id}: ${e.message}`);
    }
  }

  const known = new Set(listRuns().map((r) => r.issue.source));
  for (const [name, repo] of Object.entries(config.repos ?? {})) {
    if (!repo.github) continue;
    for (const issue of listLabeledIssues(repo.github, config.label)) {
      const ref = `gh:${repo.github}#${issue.number}`;
      if (known.has(ref)) continue;
      console.log(`\nNew issue ${name}#${issue.number}: ${issue.title}`);
      try {
        await execute(config, startRun(config, ref, { pr: true }));
      } catch (e) {
        console.error(`${ref}: ${e.message}`);
      }
      acted++;
    }
  }
  return acted;
}

export async function poll(config, { watchSec } = {}) {
  for (;;) {
    const acted = await pollOnce(config);
    if (!watchSec) return console.log(acted ? `\nHandled ${acted} item(s).` : 'Nothing to do.');
    await new Promise((r) => setTimeout(r, watchSec * 1000));
  }
}
