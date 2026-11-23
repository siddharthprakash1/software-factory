import path from 'node:path';
import { ROOT } from './paths.mjs';
import { loadIssue } from './issues.mjs';
import { saveRun, loadRun, record, writeRunFile, readRunFile } from './runs.mjs';
import { git, tail, createWorkspace, commitAll, runChecks } from './workspace.mjs';
import { deliver } from './deliver.mjs';
import { runAgent, parseJson } from './agents/harness.mjs';
import { triagePrompt, specPrompt, implementPrompt, reviewPrompt } from './agents/prompts.mjs';

// Thrown when a run must stop and wait for a person.
class Pause extends Error {}

export function startRun(config, issueRef, { repo, pr } = {}) {
  const issue = loadIssue(issueRef);
  const repoPath = path.resolve(ROOT, repo ?? config.repo);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
  const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const id = `${stamp}-${slug}`;
  const run = {
    id,
    issue,
    repo: repoPath,
    ...createWorkspace(repoPath, id),
    openPr: !!pr,
    status: 'running',
    next: 'triage',
    iteration: 0,
    budgetUsd: config.budgetUsd,
    costUsd: 0,
    startedAt: new Date().toISOString(),
    events: [],
  };
  saveRun(run);
  return run;
}

// Runs one agent for a stage, enforcing the budget and logging its output and cost.
async function agent(config, run, stage, prompt, model) {
  if (run.costUsd >= run.budgetUsd) throw new Pause(`budget of $${run.budgetUsd} reached before ${stage}`);
  console.log(`[${stage}:${model}] running...`);
  const r = await runAgent(config, config.stages[stage], { model, prompt, cwd: run.worktree });
  run.costUsd += r.costUsd;
  const n = String(run.events.length + 1).padStart(2, '0');
  writeRunFile(run, `${n}-${stage}.md`, r.text || r.error || '');
  const meta = { harness: r.harness, model, costUsd: r.costUsd, durationMs: r.durationMs, tokensIn: r.tokensIn, tokensOut: r.tokensOut };
  if (!r.ok) {
    record(run, stage, 'agent_error', meta);
    throw new Pause(`${stage} agent failed: ${tail(String(r.error), 500)}`);
  }
  return { text: r.text, meta };
}

// Each stage returns the name of the next stage, or null after setting a final/paused status.
const STAGES = {
  async triage(config, run) {
    const { text, meta } = await agent(config, run, 'triage', triagePrompt(run.issue), config.stages.triage.model);
    const t = parseJson(text);
    if (!t?.decision) {
      record(run, 'triage', 'unparseable', meta);
      throw new Pause('triage agent did not return a decision');
    }
    run.triage = t;
    record(run, 'triage', `${t.decision}/${t.complexity}`, meta);
    if (t.decision === 'park') {
      run.status = 'parked';
      run.note = `${t.reason} ${t.plan ?? ''}`.trim();
      return null;
    }
    return t.decision === 'needs_spec' ? 'spec' : 'implement';
  },

  async spec(config, run) {
    const { text, meta } = await agent(config, run, 'spec', specPrompt(run.issue, run.triage), config.stages.spec.model);
    writeRunFile(run, 'spec.md', text);
    record(run, 'spec', 'written', meta);
    run.status = 'awaiting_spec_approval';
    run.note = `Review and edit .factory/runs/${run.id}/spec.md, then: npm run factory -- resume ${run.id}`;
    run.next = 'implement';
    return null;
  },

  async implement(config, run) {
    if (run.iteration >= config.maxIterations) {
      throw new Pause(`still failing after ${run.iteration} attempts. Last feedback:\n${run.feedback}`);
    }
    run.iteration += 1;
    const routing = config.stages.implement.model;
    const model = typeof routing === 'string' ? routing : routing[run.triage?.complexity] ?? routing.medium;
    const prompt = implementPrompt(run.issue, {
      plan: run.triage?.plan,
      spec: readRunFile(run, 'spec.md'),
      feedback: run.feedback,
      verify: config.verify ?? [],
    });
    const { meta } = await agent(config, run, 'implement', prompt, model);
    const changed = commitAll(run.worktree, `factory: ${run.issue.title} (attempt ${run.iteration})`);
    record(run, 'implement', `attempt ${run.iteration} ${changed ? 'committed' : 'changed nothing'}`, meta);
    if (!changed && git(run.worktree, 'rev-parse', 'HEAD') === run.base) {
      run.feedback = 'You finished without changing any files. Make the change the issue asks for.';
      return 'implement';
    }
    return 'verify';
  },

  async verify(config, run) {
    const started = Date.now();
    const v = runChecks(run.worktree, config.verify ?? []);
    run.verifyLog = v.log;
    writeRunFile(run, 'verify.log', v.log);
    record(run, 'verify', v.ok ? 'passed' : `failed: ${v.failed}`, { durationMs: Date.now() - started });
    if (v.ok) return 'review';
    run.feedback = `The check \`${v.failed}\` failed:\n${tail(v.log, 4000)}`;
    return 'implement';
  },

  async review(config, run) {
    const diff = tail(git(run.worktree, 'diff', `${run.base}..HEAD`), 60_000);
    const { text, meta } = await agent(config, run, 'review', reviewPrompt(run.issue, diff), config.stages.review.model);
    const r = parseJson(text);
    if (!r?.verdict) {
      record(run, 'review', 'unparseable', meta);
      throw new Pause('review agent did not return a verdict');
    }
    run.review = r;
    record(run, 'review', r.verdict, meta);
    if (r.verdict === 'approve') return 'deliver';
    run.feedback = `Code review requested changes: ${r.summary}\n- ${(r.comments ?? []).join('\n- ')}`;
    return 'implement';
  },

  async deliver(config, run) {
    deliver(run);
    run.status = 'ready_for_review';
    run.note = run.pr ?? `Branch ${run.branch} is ready. Report: .factory/runs/${run.id}/report.md`;
    record(run, 'deliver', run.pr ? 'pr opened' : 'branch ready');
    return null;
  },
};

// Drives a run from its current stage until it finishes or pauses.
export async function advance(config, run) {
  run.status = 'running';
  delete run.note;
  try {
    while (run.next) {
      const next = await STAGES[run.next](config, run);
      if (next) run.next = next;
      else if (run.status === 'running') throw new Error(`stage ${run.next} ended without a status`);
      else if (run.status !== 'awaiting_spec_approval') run.next = null;
      saveRun(run);
      if (run.status !== 'running') break;
    }
  } catch (e) {
    run.status = 'needs_human';
    run.note = e instanceof Pause ? e.message : `factory error: ${e.message}`;
    saveRun(run);
    if (!(e instanceof Pause)) throw e;
  }
  run.endedAt = new Date().toISOString();
  saveRun(run);
  return run;
}

// A human steers a paused run: approve a spec, add guidance, or grant more attempts and budget.
export async function resume(config, id, { feedback } = {}) {
  const run = loadRun(id);
  if (!['awaiting_spec_approval', 'needs_human'].includes(run.status)) {
    throw new Error(`run ${id} is ${run.status}; nothing to resume`);
  }
  if (run.status === 'needs_human') {
    run.iteration = 0;
    run.budgetUsd += config.budgetUsd;
  }
  if (feedback) run.feedback = `${run.feedback ? run.feedback + '\n\n' : ''}Guidance from the human reviewer: ${feedback}`;
  record(run, 'human', feedback ? 'resumed with guidance' : 'resumed');
  return advance(config, run);
}
