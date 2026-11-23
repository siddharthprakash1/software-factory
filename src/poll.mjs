import { listRuns, saveRun, record } from './runs.mjs';
import { startRun, execute, resume } from './pipeline.mjs';
import { listLabeledIssues, humanCommentsSince, prState, prNumber } from './github.mjs';
import { sanitize } from './issues.mjs';

const WAITING = ['parked', 'awaiting_spec_approval', 'needs_human', 'ready_for_review'];

// One pass over GitHub: start runs for newly labelled issues, feed new human comments back
// into waiting runs, and close out runs whose PR was merged or closed.
export async function pollOnce(config) {
  let acted = 0;

  for (const run of listRuns().filter((r) => !r.eval && r.github && r.issue.number && WAITING.includes(r.status))) {
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
      const trusted = config.trustedAuthors;
      const sources = [humanCommentsSince(run.github, run.issue.number, run.lastSeenAt, { trusted })];
      if (pr) sources.push(humanCommentsSince(run.github, pr, run.lastSeenAt, { isPr: true, trusted }));
      const ignored = sources.reduce((n, s) => n + s.ignored, 0);
      if (ignored) console.log(`${run.id}: ignored ${ignored} comment(s) from people without write access`);
      const comments = sources.flatMap((s) => s.comments).sort((a, b) => a.at.localeCompare(b.at));
      if (!comments.length) continue;
      console.log(`\n${run.id}: ${comments.length} new comment(s), resuming`);
      run.lastSeenAt = comments.at(-1).at;
      saveRun(run);
      await resume(config, run.id, { feedback: comments.map((c) => sanitize(c.body)).join('\n\n') });
      acted++;
    } catch (e) {
      console.error(`${run.id}: ${e.message}`);
    }
  }

  const known = new Set(listRuns().map((r) => r.issue.source));
  const fresh = [];
  for (const [name, repo] of Object.entries(config.repos ?? {})) {
    if (!repo.github) continue;
    for (const issue of listLabeledIssues(repo.github, config.label)) {
      const ref = `gh:${repo.github}#${issue.number}`;
      if (known.has(ref)) continue;
      console.log(`New issue ${name}#${issue.number}: ${issue.title}`);
      fresh.push(ref);
    }
  }
  // Worktrees are created one at a time; the runs themselves go in parallel, a few at once.
  const queue = fresh.map((ref) => {
    try {
      return startRun(config, ref, { pr: true });
    } catch (e) {
      console.error(`${ref}: ${e.message}`);
      return null;
    }
  }).filter(Boolean);
  const worker = async () => {
    for (let run; (run = queue.shift()); ) {
      await execute(config, run).catch((e) => console.error(`${run.issue.source}: ${e.message}`));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, config.concurrency ?? 2) }, worker));
  return acted + fresh.length;
}

export async function poll(config, { watchSec } = {}) {
  for (;;) {
    const acted = await pollOnce(config);
    if (!watchSec) return console.log(acted ? `\nHandled ${acted} item(s).` : 'Nothing to do.');
    await new Promise((r) => setTimeout(r, watchSec * 1000));
  }
}
