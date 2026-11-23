import fs from 'node:fs';
import path from 'node:path';
import { RUNS, runDir } from './paths.mjs';

// Run state is one JSON file per run: .factory/runs/<id>/run.json

export function saveRun(run) {
  fs.mkdirSync(runDir(run.id), { recursive: true });
  fs.writeFileSync(path.join(runDir(run.id), 'run.json'), JSON.stringify(run, null, 2));
}

export function loadRun(id) {
  return JSON.parse(fs.readFileSync(path.join(runDir(id), 'run.json'), 'utf8'));
}

export function listRuns() {
  if (!fs.existsSync(RUNS)) return [];
  return fs
    .readdirSync(RUNS)
    .filter((d) => fs.existsSync(path.join(RUNS, d, 'run.json')))
    .sort()
    .map(loadRun);
}

export function writeRunFile(run, name, content) {
  fs.mkdirSync(runDir(run.id), { recursive: true });
  fs.writeFileSync(path.join(runDir(run.id), name), content);
}

export function readRunFile(run, name) {
  const file = path.join(runDir(run.id), name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

// Appends to the run's event log, saves, and prints one progress line.
export function record(run, stage, outcome, extra = {}) {
  run.events.push({ at: new Date().toISOString(), stage, outcome, ...extra });
  saveRun(run);
  const cost = extra.costUsd != null ? ` $${extra.costUsd.toFixed(3)}` : '';
  const secs = extra.durationMs != null ? ` ${Math.round(extra.durationMs / 1000)}s` : '';
  console.log(`[${stage}${extra.model ? ':' + extra.model : ''}] ${outcome}${cost}${secs}`);
}
