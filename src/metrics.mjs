import { listRuns } from './runs.mjs';

export const usd = (n) => `$${n.toFixed(3)}`;
const pct = (n, d) => `${((n / d) * 100).toFixed(0)}%`;

export function printMetrics() {
  const runs = listRuns();
  if (!runs.length) return console.log('No runs yet.');

  const byStatus = {};
  const stages = {};
  for (const run of runs) {
    byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;
    for (const e of run.events) {
      const s = (stages[e.stage] ??= { calls: 0, costUsd: 0, ms: 0 });
      s.calls += 1;
      s.costUsd += e.costUsd ?? 0;
      s.ms += e.durationMs ?? 0;
    }
  }
  const delivered = runs.filter((r) => r.status === 'ready_for_review');
  const unaided = delivered.filter((r) => !r.events.some((e) => e.stage === 'human'));
  const total = runs.reduce((sum, r) => sum + r.costUsd, 0);

  console.log(`Runs: ${runs.length}   ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join('   ')}`);
  console.log(`Delivered: ${pct(delivered.length, runs.length)}   without human help: ${pct(unaided.length, runs.length)}`);
  console.log(`Total cost: ${usd(total)}`);
  if (delivered.length) {
    const attempts = delivered.reduce((sum, r) => sum + r.iteration, 0) / delivered.length;
    console.log(`Cost per delivered change: ${usd(total / delivered.length)}`);
    console.log(`Avg attempts per delivered change: ${attempts.toFixed(1)}`);
    console.log(`Factory efficiency (delivered changes per $): ${total ? (delivered.length / total).toFixed(2) : 'n/a'}`);
  }
  console.log('\nBy stage:');
  console.table(
    Object.fromEntries(
      Object.entries(stages).map(([name, s]) => [name, { calls: s.calls, cost: usd(s.costUsd), minutes: +(s.ms / 60000).toFixed(1) }]),
    ),
  );
}
