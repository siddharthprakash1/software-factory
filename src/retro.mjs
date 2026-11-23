import fs from 'node:fs';
import path from 'node:path';
import { DATA } from './paths.mjs';
import { listRuns } from './runs.mjs';
import { runAgent } from './agents/harness.mjs';
import { retroPrompt } from './agents/prompts.mjs';

// Where the factory itself loses time and money, counted from its own run logs.
export function friction(runs) {
  const sources = {};
  const stages = {};
  const samples = [];
  for (const run of runs) {
    for (const f of run.feedbackLog ?? []) {
      sources[f.source] = (sources[f.source] ?? 0) + 1;
      if (samples.length < 12) samples.push(`[${run.repoName}] [${f.source}] ${f.text.slice(0, 300)}`);
    }
    for (const e of run.events) {
      const s = (stages[e.stage] ??= { calls: 0, costUsd: 0, seconds: 0 });
      s.calls += 1;
      s.costUsd += e.costUsd ?? 0;
      s.seconds += (e.durationMs ?? 0) / 1000;
    }
  }
  const count = (fn) => runs.filter(fn).length;
  return {
    runs: runs.length,
    firstTry: count((r) => ['ready_for_review', 'merged'].includes(r.status) && r.iteration === 1 && !r.events.some((e) => e.stage === 'human')),
    neededRetries: count((r) => r.iteration > 1),
    neededAPerson: count((r) => r.events.some((e) => e.stage === 'human')),
    stuck: count((r) => r.status === 'needs_human'),
    parked: count((r) => r.status === 'parked'),
    feedbackBySource: sources,
    stages,
    samples,
  };
}

// Prints the friction numbers, then has an agent propose changes to the factory itself.
export async function retro(config, { last = 30 } = {}) {
  const runs = listRuns().filter((r) => !r.eval).slice(-last);
  if (!runs.length) return console.log('No runs to look at yet.');
  const f = friction(runs);
  const lines = [
    `# Factory retro, ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Last ${f.runs} runs: ${f.firstTry} delivered first try, ${f.neededRetries} needed retries, ${f.neededAPerson} needed a person, ${f.stuck} stuck, ${f.parked} parked.`,
    '',
    '## What sent work back',
    ...(Object.keys(f.feedbackBySource).length
      ? Object.entries(f.feedbackBySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`)
      : ['- nothing: no run received feedback']),
    '',
    '## Cost and time by stage',
    ...Object.entries(f.stages)
      .filter(([, s]) => s.costUsd > 0 || s.seconds > 0)
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
      .map(([k, s]) => `- ${k}: ${s.calls} calls, $${s.costUsd.toFixed(3)}, ${Math.round(s.seconds)}s`),
  ];

  const def = config.stages.retro;
  let cost = 0;
  if (def) {
    const stageSummary = Object.entries(config.stages).map(([k, s]) => `${k}: model ${JSON.stringify(s.model)}`).join('\n');
    const r = await runAgent(config, def, { model: def.model, prompt: retroPrompt(lines.join('\n'), f.samples, stageSummary), cwd: process.cwd() });
    cost = r.costUsd;
    lines.push('', '## Proposed changes to the factory', '', r.ok ? r.text.trim() : `(retro agent failed: ${r.error})`);
  }
  const file = path.join(DATA, `retro-${new Date().toISOString().slice(0, 10)}.md`);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\nSaved ${file}${cost ? `  ($${cost.toFixed(3)})` : ''}`);
}
