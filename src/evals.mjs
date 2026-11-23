import fs from 'node:fs';
import path from 'node:path';
import { EVALS } from './paths.mjs';
import { loadConfig } from './config.mjs';
import { startRun, execute } from './pipeline.mjs';
import { runChecks } from './workspace.mjs';
import { saveRun, loadRun } from './runs.mjs';

// Re-runs the issue of an earlier run from the same starting commit under another config variant,
// so a change to the factory can be judged on real past work. Nothing is posted to GitHub.
export async function replay(id, variant) {
  const old = loadRun(id);
  const config = { ...(await loadConfig(variant)), memory: false };
  const run = startRun(config, null, {
    repo: old.repoName ?? old.repo,
    issue: old.issue,
    base: old.base,
    tags: { eval: { suite: 'replay', variant, of: id } },
  });
  await execute(config, run, { quiet: true });
  const row = (r) => ({
    status: r.status,
    attempts: r.iteration,
    cost: `$${r.costUsd.toFixed(3)}`,
    seconds: Math.round((new Date(r.endedAt) - new Date(r.startedAt)) / 1000),
  });
  console.log(`\nReplay of ${id}`);
  console.table({ original: row(old), [`replay (${variant})`]: row(run) });
  console.log(`Compare the code: git -C "${run.repo}" diff ${old.branch} ${run.branch}`);
}

// A suite is a JSON file:
//   { "name": "...", "repo": "<name in config.repos>",
//     "cases": [{ "issue": "path.md", "accept": { "files": { "<dest in repo>": "<source>" }, "cmd": "..." } }] }
// Paths are relative to the suite file. `accept` is a hidden check the agents never see: its files
// are copied into the finished worktree and `cmd` must pass for the case to count as accepted.
export async function runEval(suiteFile, variants) {
  const dir = path.dirname(path.resolve(suiteFile));
  const suite = JSON.parse(fs.readFileSync(suiteFile, 'utf8'));
  const results = [];

  for (const variant of variants) {
    const config = { ...(await loadConfig(variant)), memory: false }; // same starting point for every variant
    for (const c of suite.cases) {
      console.log(`\n=== ${suite.name} / ${variant} / ${path.basename(c.issue)}`);
      const run = startRun(config, path.resolve(dir, c.issue), { repo: suite.repo, tags: { eval: { suite: suite.name, variant } } });
      await execute(config, run, { quiet: true });
      const delivered = run.status === 'ready_for_review';
      let accepted = null;
      if (delivered && c.accept) {
        for (const [dest, src] of Object.entries(c.accept.files ?? {})) {
          const target = path.join(run.worktree, dest);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(path.resolve(dir, src), target);
        }
        accepted = runChecks(run.worktree, [c.accept.cmd]).ok;
        console.log(`[accept] ${accepted ? 'passed' : 'FAILED'}`);
      }
      run.eval.accepted = accepted;
      saveRun(run);
      results.push({ variant, case: path.basename(c.issue), status: run.status, accepted, attempts: run.iteration, costUsd: run.costUsd, seconds: (new Date(run.endedAt) - new Date(run.startedAt)) / 1000 });
    }
  }

  const summary = {};
  for (const variant of variants) {
    const rows = results.filter((r) => r.variant === variant);
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
    summary[variant] = {
      cases: rows.length,
      delivered: rows.filter((r) => r.status === 'ready_for_review').length,
      accepted: rows.filter((r) => r.accepted === true).length,
      'avg attempts': +(sum((r) => r.attempts) / rows.length).toFixed(1),
      'total cost': `$${sum((r) => r.costUsd).toFixed(3)}`,
      'avg secs': Math.round(sum((r) => r.seconds) / rows.length),
    };
  }
  fs.mkdirSync(EVALS, { recursive: true });
  const out = path.join(EVALS, `${suite.name}-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}.json`);
  fs.writeFileSync(out, JSON.stringify({ suite: suite.name, variants, summary, results }, null, 2));

  console.log(`\nEval "${suite.name}"`);
  console.table(summary);
  console.table(results.map((r) => ({ ...r, costUsd: `$${r.costUsd.toFixed(3)}`, seconds: Math.round(r.seconds) })));
  console.log(`Saved ${out}`);
}
