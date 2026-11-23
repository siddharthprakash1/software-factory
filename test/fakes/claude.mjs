// Stand-in for the `claude` CLI. Reads the prompt on stdin, works out which stage is calling,
// and replies from a scripted scenario so the whole pipeline can run offline and for free.
//
// FAKE_SCENARIO is a JSON file: { "<stage>": [ { "text": "...", "write": { "file": "content" },
// "error": false, "cost": 0.01 }, ... ] }. Each call to a stage takes its next entry; the last
// entry repeats. Every call is appended to <scenario>.calls.json for the tests to inspect.
import fs from 'node:fs';
import path from 'node:path';

const STAGES = [
  ['triage agent', 'triage'],
  ['spec agent', 'spec'],
  ['implementation agent', 'implement'],
  ['code review agent', 'review'],
  ['verification agent', 'verify_ui'],
  ['lessons file', 'learn'],
  ['monitor agent', 'monitor'],
  ['retrospective for a software factory', 'retro'],
];

const prompt = fs.readFileSync(0, 'utf8');
const stage = STAGES.find(([needle]) => prompt.includes(needle))?.[1] ?? 'unknown';
const scenarioFile = process.env.FAKE_SCENARIO;
const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
const callsFile = `${scenarioFile}.calls.json`;
const calls = fs.existsSync(callsFile) ? JSON.parse(fs.readFileSync(callsFile, 'utf8')) : [];

const script = scenario[stage] ?? [];
const nth = calls.filter((c) => c.stage === stage).length;
const step = script[Math.min(nth, script.length - 1)] ?? { text: '' };

for (const [file, content] of Object.entries(step.write ?? {})) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, content);
}
// "remove": files the scripted agent deletes from its worktree (relative paths only).
for (const file of step.remove ?? []) {
  if (!path.isAbsolute(file) && fs.existsSync(file)) fs.unlinkSync(file);
}
const model = process.argv[process.argv.indexOf('--model') + 1];
calls.push({ stage, model, prompt, cwd: process.cwd() });
fs.writeFileSync(callsFile, JSON.stringify(calls, null, 2));

process.stdout.write(
  JSON.stringify({
    type: 'result',
    is_error: !!step.error,
    result: step.text ?? '',
    total_cost_usd: step.cost ?? 0.01,
    usage: { input_tokens: 100, output_tokens: 20 },
    session_id: 'fake',
  }),
);
