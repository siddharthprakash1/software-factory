import fs from 'node:fs';
import path from 'node:path';
import { MEMORY } from './paths.mjs';
import { runAgent } from './agents/harness.mjs';
import { learnPrompt } from './agents/prompts.mjs';
import { record } from './runs.mjs';

// One plain markdown file per repo, committed with the factory so it can be read and edited by hand.
const file = (repoName) => path.join(MEMORY, `${repoName}.md`);

export function readLessons(config, repoName) {
  if (!config.memory || !fs.existsSync(file(repoName))) return '';
  return fs.readFileSync(file(repoName), 'utf8').trim();
}

// After a run that received feedback, distil it into lessons for later runs on the same repo.
export async function learn(config, run) {
  const log = run.feedbackLog ?? [];
  const fresh = log.slice(run.learnedCount ?? 0);
  if (!config.memory || !fresh.length) return;
  const def = config.stages.learn;
  const r = await runAgent(config, def, {
    model: def.model,
    prompt: learnPrompt(run.repoName, readLessons(config, run.repoName), fresh),
    cwd: run.worktree,
  });
  run.costUsd += r.costUsd;
  run.learnedCount = log.length;
  const text = r.text.trim();
  const changed = r.ok && text && !text.includes('NO_CHANGE');
  if (changed) {
    fs.mkdirSync(MEMORY, { recursive: true });
    fs.writeFileSync(file(run.repoName), text + '\n');
  }
  record(run, 'learn', !r.ok ? 'agent_error' : changed ? 'lessons updated' : 'nothing new', {
    model: def.model,
    costUsd: r.costUsd,
    durationMs: r.durationMs,
  });
}
