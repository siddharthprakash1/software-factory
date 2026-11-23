#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { CONFIG_FILE } from './paths.mjs';
import { startRun, advance, resume } from './pipeline.mjs';
import { listRuns, loadRun } from './runs.mjs';
import { printMetrics, usd } from './metrics.mjs';

const USAGE = `Software factory

  factory run <issue.md | gh:owner/repo#123> [--repo <path>] [--pr]
  factory resume <run-id> [--feedback "guidance"]
  factory status [run-id]
  factory metrics

Run it as: npm run factory -- <command>
`;

function parseArgs(argv) {
  const flags = {};
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pr') flags.pr = true;
    else if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
    else args.push(argv[i]);
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
const config = (await import(pathToFileURL(CONFIG_FILE))).default;

try {
  if (cmd === 'run' && args[0]) {
    const run = startRun(config, args[0], flags);
    console.log(`Run ${run.id}\nWorktree ${run.worktree}\n`);
    printSummary(await advance(config, run));
  } else if (cmd === 'resume' && args[0]) {
    printSummary(await resume(config, args[0], flags));
  } else if (cmd === 'status' && args[0]) {
    const run = loadRun(args[0]);
    printSummary(run);
    printEvents(run);
  } else if (cmd === 'status') {
    listRuns().forEach(printSummary);
  } else if (cmd === 'metrics') {
    printMetrics();
  } else {
    console.log(USAGE);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
