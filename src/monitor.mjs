import fs from 'node:fs';
import path from 'node:path';
import { INBOX } from './paths.mjs';
import { resolveRepo } from './config.mjs';
import { runChecks, tail } from './workspace.mjs';
import { runAgent, parseJson } from './agents/harness.mjs';
import { monitorPrompt } from './agents/prompts.mjs';
import { failedCiRuns, listOpenIssueTitles, createIssue, ensureLabel } from './github.mjs';

const PROPOSED = 'factory-proposed';

// Collects health signals for a repo's main checkout. When something is failing, an agent
// finds the cause and proposes issues: on GitHub when the repo has one, else in .factory/inbox.
// Proposed issues are not picked up automatically unless `auto` adds the trigger label.
export async function monitor(config, repoName, { auto = false, max = 3, signal } = {}) {
  const repo = resolveRepo(config, repoName);
  const signals = [];

  for (const cmd of signal ? [signal] : repo.signals ?? []) {
    console.log(`[monitor] ${cmd}`);
    const r = runChecks(repo.path, [cmd]);
    if (!r.ok) signals.push(`Command \`${cmd}\` fails on the main checkout:\n${tail(r.log, 4000)}`);
  }
  if (repo.github) {
    for (const run of failedCiRuns(repo.github)) {
      signals.push(`CI workflow "${run.name}" failed on ${run.headBranch} at ${run.createdAt}:\n${run.log}`);
    }
  }
  if (!signals.length) return console.log('[monitor] all signals healthy, nothing to report');

  const inbox = path.join(INBOX, repo.name);
  const open = repo.github
    ? listOpenIssueTitles(repo.github)
    : fs.existsSync(inbox) ? fs.readdirSync(inbox).map((f) => fs.readFileSync(path.join(inbox, f), 'utf8').split('\n')[0].replace(/^#\s*/, '')) : [];

  const def = config.stages.monitor;
  console.log(`[monitor:${def.model}] ${signals.length} failing signal(s), investigating...`);
  const r = await runAgent(config, def, { model: def.model, prompt: monitorPrompt(signals.join('\n\n'), open, max), cwd: repo.path });
  const issues = (r.ok && parseJson(r.text)?.issues) || [];
  console.log(`[monitor] ${issues.length} issue(s) proposed  $${r.costUsd.toFixed(3)}`);
  if (!r.ok) throw new Error(`monitor agent failed: ${r.error}`);

  for (const issue of issues.slice(0, max)) {
    const body = `${issue.body}\n\n_Filed by the software factory's monitor._`;
    if (repo.github) {
      ensureLabel(repo.github, PROPOSED, 'Proposed by the software factory monitor');
      if (auto) ensureLabel(repo.github, config.label, 'Picked up by the software factory');
      console.log(`  ${createIssue(repo.github, issue.title, body, auto ? [PROPOSED, config.label] : [PROPOSED])}`);
    } else {
      fs.mkdirSync(inbox, { recursive: true });
      const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      const file = path.join(inbox, `${new Date().toISOString().slice(0, 10)}-${slug}.md`);
      fs.writeFileSync(file, `# ${issue.title}\n\n${body}\n`);
      console.log(`  ${file}`);
    }
  }
}
