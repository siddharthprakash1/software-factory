import fs from 'node:fs';
import path from 'node:path';
import { runDir } from './paths.mjs';
import { resolveRepo, resolveModel } from './config.mjs';
import { loadIssue } from './issues.mjs';
import { saveRun, loadRun, record, writeRunFile, readRunFile } from './runs.mjs';
import { git, tail, createWorkspace, commitAll, runChecks } from './workspace.mjs';
import { deliver } from './deliver.mjs';
import { withServer } from './ui-verify.mjs';
import { readLessons, learn } from './memory.mjs';
import { notify } from './notify.mjs';
import { runAgent, parseJson } from './agents/harness.mjs';
import { triagePrompt, specPrompt, implementPrompt, reviewPrompt, uiVerifyPrompt } from './agents/prompts.mjs';

// Thrown when a run must stop and wait for a person.
class Pause extends Error {}

const repoOf = (config, run) => resolveRepo(config, run.repoName ?? run.repo);

export function startRun(config, issueRef, { repo, path: checkout, pr, tags } = {}) {
  const issue = loadIssue(config, issueRef);
  const target = resolveRepo(config, repo ?? issue.repoName);
  if (checkout) target.path = path.resolve(checkout); // e.g. the CI checkout instead of the configured one
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
  const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
  const id = `${stamp}-${slug}`;
  const run = {
    id,
    issue,
    repoName: target.name,
    repo: target.path,
    github: target.github ?? null,
    ...createWorkspace(target.path, id),
    openPr: !!pr && !!target.github,
    status: 'running',
    next: 'triage',
    iteration: 0,
    budgetUsd: config.budgetUsd,
    costUsd: 0,
    startedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(), // human comments newer than this are unhandled feedback
    feedbackLog: [],
    events: [],
    ...tags,
  };
  saveRun(run);
  return run;
}

function setFeedback(run, source, text) {
  run.feedback = text;
  (run.feedbackLog ??= []).push({ source, text: tail(text, 1500) });
}

// Runs one agent for a stage, enforcing the budget and logging its output and cost.
async function agent(config, run, stage, prompt) {
  if (run.costUsd >= run.budgetUsd) throw new Pause(`budget of $${run.budgetUsd} reached before ${stage}`);
  const def = config.stages[stage];
  const model = resolveModel(def, run.triage?.complexity);
  console.log(`[${stage}:${model}] running...`);
  const r = await runAgent(config, def, { model, prompt, cwd: run.worktree });
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
    const lessons = readLessons(config, run.repoName);
    const { text, meta } = await agent(config, run, 'triage', triagePrompt(run.issue, { lessons }));
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
    const { text, meta } = await agent(config, run, 'spec', specPrompt(run.issue, run.triage));
    writeRunFile(run, 'spec.md', text);
    record(run, 'spec', 'written', meta);
    run.status = 'awaiting_spec_approval';
    run.note = `Review and edit .factory/runs/${run.id}/spec.md, then: npm run factory -- resume ${run.id}`;
    return null;
  },

  async implement(config, run) {
    if (run.iteration >= config.maxIterations) {
      throw new Pause(`still failing after ${run.iteration} attempts. Last feedback:\n${run.feedback}`);
    }
    run.iteration += 1;
    const prompt = implementPrompt(run.issue, {
      plan: run.triage?.plan,
      spec: readRunFile(run, 'spec.md'),
      feedback: run.feedback,
      verify: repoOf(config, run).verify,
      lessons: readLessons(config, run.repoName),
    });
    const { meta } = await agent(config, run, 'implement', prompt);
    const changed = commitAll(run.worktree, `factory: ${run.issue.title} (attempt ${run.iteration})`);
    record(run, 'implement', `attempt ${run.iteration} ${changed ? 'committed' : 'changed nothing'}`, meta);
    if (!changed && git(run.worktree, 'rev-parse', 'HEAD') === run.base) {
      setFeedback(run, 'factory', 'You finished without changing any files. Make the change the issue asks for.');
      return 'implement';
    }
    return 'verify';
  },

  async verify(config, run) {
    const repo = repoOf(config, run);
    const started = Date.now();
    const v = runChecks(run.worktree, repo.verify);
    run.verifyLog = v.log;
    writeRunFile(run, 'verify.log', v.log);
    record(run, 'verify', v.ok ? 'passed' : `failed: ${v.failed}`, { durationMs: Date.now() - started });
    if (v.ok) return repo.ui ? 'verify_ui' : 'review';
    setFeedback(run, 'checks', `The check \`${v.failed}\` failed:\n${tail(v.log, 4000)}`);
    return 'implement';
  },

  // Optional: start the app and have an agent check the behaviour in a real browser.
  async verify_ui(config, run) {
    const { ui } = repoOf(config, run);
    // The browser tools may only write inside the worktree, so the shot is taken there and moved out.
    const shot = path.join(run.worktree, 'factory-ui-check.png');
    const screenshot = path.join(runDir(run.id), `ui-attempt-${run.iteration}.png`);
    const { text, meta } = await withServer(ui, run.worktree, () =>
      agent(config, run, 'verify_ui', uiVerifyPrompt(run.issue, { url: ui.url, screenshot: shot })),
    );
    if (fs.existsSync(shot)) {
      fs.copyFileSync(shot, screenshot);
      fs.rmSync(shot);
    }
    const v = parseJson(text);
    if (!v?.verdict) {
      record(run, 'verify_ui', 'unparseable', meta);
      throw new Pause('browser verification agent did not return a verdict');
    }
    run.uiCheck = { ...v, screenshot: fs.existsSync(screenshot) ? screenshot : null };
    record(run, 'verify_ui', v.verdict, meta);
    if (v.verdict === 'pass') return 'review';
    setFeedback(run, 'browser check', `Checking the running app in a browser failed: ${v.summary}\n- ${(v.problems ?? []).join('\n- ')}`);
    return 'implement';
  },

  async review(config, run) {
    const diff = tail(git(run.worktree, 'diff', `${run.base}..HEAD`), 60_000);
    const lessons = readLessons(config, run.repoName);
    const { text, meta } = await agent(config, run, 'review', reviewPrompt(run.issue, diff, { lessons, verify: repoOf(config, run).verify }));
    const r = parseJson(text);
    if (!r?.verdict) {
      record(run, 'review', 'unparseable', meta);
      throw new Pause('review agent did not return a verdict');
    }
    run.review = r;
    record(run, 'review', r.verdict, meta);
    if (r.verdict === 'approve') return 'deliver';
    setFeedback(run, 'code review', `Code review requested changes: ${r.summary}\n- ${(r.comments ?? []).join('\n- ')}`);
    return 'implement';
  },

  async deliver(config, run) {
    const updated = !!run.pr;
    deliver(run);
    run.status = 'ready_for_review';
    run.note = run.pr ?? `Branch ${run.branch} is ready. Report: .factory/runs/${run.id}/report.md`;
    record(run, 'deliver', run.pr ? (updated ? 'pr updated' : 'pr opened') : 'branch ready');
    return null;
  },
};

// Where a paused or finished run continues from when a human responds.
const RESUME_FROM = { parked: 'triage', awaiting_spec_approval: 'implement', ready_for_review: 'implement' };

// Drives a run from its current stage until it finishes or pauses.
export async function advance(config, run) {
  run.status = 'running';
  delete run.note;
  try {
    while (run.status === 'running') {
      const next = await STAGES[run.next](config, run);
      if (next) run.next = next;
      else if (run.status === 'running') throw new Error(`stage ${run.next} ended without a status`);
      saveRun(run);
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

// advance, then learn from the feedback the run received and report back to GitHub.
export async function execute(config, run, { quiet = false } = {}) {
  try {
    await advance(config, run);
  } finally {
    if (!quiet) {
      if (run.status === 'ready_for_review') await learn(config, run).catch((e) => console.error(`learn failed: ${e.message}`));
      try {
        notify(run);
      } catch (e) {
        console.error(`notify failed: ${e.message}`);
      }
      saveRun(run);
    }
  }
  return run;
}

// A human steers a run: answer a parked issue, approve a spec, unblock a stuck run, or ask for
// changes to a delivered one.
export async function resume(config, id, { feedback } = {}) {
  const run = loadRun(id);
  if (!(run.status in RESUME_FROM) && run.status !== 'needs_human') {
    throw new Error(`run ${id} is ${run.status}; nothing to resume`);
  }
  if (run.status === 'ready_for_review' && !feedback) throw new Error('a delivered run needs --feedback to revise');
  if (run.status === 'parked') {
    if (!feedback) throw new Error('a parked run needs --feedback with the missing information');
    run.issue.body += `\n\nAdditional information from the reporter:\n${feedback}`;
  } else if (feedback) {
    setFeedback(run, 'human', `${run.status === 'needs_human' && run.feedback ? run.feedback + '\n\n' : ''}Guidance from the human reviewer: ${feedback}`);
  }
  run.next = RESUME_FROM[run.status] ?? run.next;
  run.iteration = run.status === 'awaiting_spec_approval' ? run.iteration : 0;
  if (run.costUsd >= run.budgetUsd) run.budgetUsd += config.budgetUsd;
  record(run, 'human', feedback ? 'resumed with guidance' : 'resumed');
  return execute(config, run);
}
