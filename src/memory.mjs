import fs from 'node:fs';
import path from 'node:path';
import { MEMORY } from './paths.mjs';
import { runAgent } from './agents/harness.mjs';
import { learnPrompt } from './agents/prompts.mjs';
import { record } from './runs.mjs';

// One plain markdown file per repo, committed with the factory so it can be read and edited by hand.
// Agents read only the approved file. New lessons go to <repo>.pending.md until a person approves
// them, because a lessons file is instructions to every later run: if one run could write it
// unchecked, a prompt injection in one issue would steer all the runs after it.
const file = (repoName) => path.join(MEMORY, `${repoName}.md`);
const pendingFile = (repoName) => path.join(MEMORY, `${repoName}.pending.md`);
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '');

export function readLessons(config, repoName) {
  return config.memory ? read(file(repoName)) : '';
}

export const readPending = (repoName) => read(pendingFile(repoName));

export function pendingRepos() {
  if (!fs.existsSync(MEMORY)) return [];
  return fs.readdirSync(MEMORY).filter((f) => f.endsWith('.pending.md')).map((f) => f.replace(/\.pending\.md$/, ''));
}

export function approveLessons(repoName) {
  if (!fs.existsSync(pendingFile(repoName))) throw new Error(`no pending lessons for ${repoName}`);
  fs.renameSync(pendingFile(repoName), file(repoName));
}

export function rejectLessons(repoName) {
  if (!fs.existsSync(pendingFile(repoName))) throw new Error(`no pending lessons for ${repoName}`);
  fs.unlinkSync(pendingFile(repoName));
}

// After a run that received feedback, distil it into proposed lessons for later runs on the same repo.
export async function learn(config, run) {
  const log = run.feedbackLog ?? [];
  const fresh = log.slice(run.learnedCount ?? 0);
  if (!config.memory || !fresh.length) return;
  const def = config.stages.learn;
  const current = readPending(run.repoName) || readLessons(config, run.repoName);
  const r = await runAgent(config, def, {
    model: def.model,
    prompt: learnPrompt(run.repoName, current, fresh),
    cwd: run.worktree,
  });
  run.costUsd += r.costUsd;
  run.learnedCount = log.length;
  const text = r.text.trim();
  const changed = r.ok && text && !text.includes('NO_CHANGE');
  const review = config.memoryReview !== false;
  if (changed) {
    fs.mkdirSync(MEMORY, { recursive: true });
    fs.writeFileSync(review ? pendingFile(run.repoName) : file(run.repoName), text + '\n');
  }
  const outcome = !r.ok ? 'agent_error' : !changed ? 'nothing new' : review ? 'lessons proposed' : 'lessons updated';
  record(run, 'learn', outcome, { model: def.model, costUsd: r.costUsd, durationMs: r.durationMs });
}
