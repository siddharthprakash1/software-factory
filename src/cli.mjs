#!/usr/bin/env node
import { loadConfig } from './config.mjs';
import { startRun, execute, resume } from './pipeline.mjs';
import { listRuns, loadRun } from './runs.mjs';
import { printMetrics, usd } from './metrics.mjs';
import { poll } from './poll.mjs';
import { monitor } from './monitor.mjs';
import { runEval, replay } from './evals.mjs';
import { dashboard } from './dashboard.mjs';

const USAGE = `Software factory

  run <issue.md | repo#123 | gh:owner/repo#123> [--repo <name|path>] [--path <checkout>] [--pr]
                                    take one issue through the pipeline
  resume <run-id> [--feedback "..."] answer, approve, unblock or revise a run
  poll [--watch <seconds>]           pick up labelled GitHub issues and new comments
  monitor [--repo <name>] [--auto] [--signal "cmd"]
                                     check repo health and propose issues
  eval <suite.json> [--variant a,b]  run a suite against config variants
  replay <run-id> [--variant name]   redo a past run's issue from the same commit under a variant
  status [run-id]                 list runs, or show one run's event log
  metrics                            totals across runs
  dashboard [--serve <port>]         write .factory/dashboard.html, optionally serve it live

Run it as: npm run factory -- <command>
`;

const BOOLEAN = new Set(['pr', 'auto']);

function parseArgs(argv) {
  const flags = {};
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) args.push(argv[i]);
    else if (BOOLEAN.has(argv[i].slice(2))) flags[argv[i].slice(2)] = true;
    else flags[argv[i].slice(2)] = argv[++i];
  }
  return { cmd: args.shift(), args, flags };
}

function printSummary(run) {
  console.log(`\n${run.id}\n  status: ${run.status}   cost: ${usd(run.costUsd)}   attempts: ${run.iteration}`);
  if (run.note) console.log(`  ${run.note.replaceAll('\n', '\n  ')}`);
}

function printEvents(run) {
  console.table(
    run.events.map((e) => ({
      stage: e.stage,
      model: e.model ?? '',
      outcome: e.outcome,
      cost: e.costUsd != null ? usd(e.costUsd) : '',
      secs: e.durationMs != null ? Math.round(e.durationMs / 1000) : '',
    })),
  );
}

const { cmd, args, flags } = parseArgs(process.argv.slice(2));
const config = await loadConfig();

try {
  if (cmd === 'run' && args[0]) {
    const run = startRun(config, args[0], flags);
    console.log(`Run ${run.id}\nWorktree ${run.worktree}\n`);
    printSummary(await execute(config, run));
  } else if (cmd === 'resume' && args[0]) {
    printSummary(await resume(config, args[0], flags));
  } else if (cmd === 'poll') {
    await poll(config, { watchSec: flags.watch ? Number(flags.watch) : 0 });
  } else if (cmd === 'monitor') {
    await monitor(config, flags.repo, { auto: flags.auto, signal: flags.signal });
  } else if (cmd === 'eval' && args[0]) {
    await runEval(args[0], (flags.variant ?? 'default').split(','));
  } else if (cmd === 'replay' && args[0]) {
    await replay(args[0], flags.variant ?? 'default');
  } else if (cmd === 'status' && args[0]) {
    const run = loadRun(args[0]);
    printSummary(run);
    printEvents(run);
  } else if (cmd === 'status') {
    listRuns().filter((r) => !r.eval).forEach(printSummary);
  } else if (cmd === 'metrics') {
    printMetrics();
  } else if (cmd === 'dashboard') {
    dashboard({ port: flags.serve ? Number(flags.serve) : 0 });
  } else {
    console.log(USAGE);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
