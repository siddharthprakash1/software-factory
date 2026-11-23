import { listRuns } from './runs.mjs';

export const usd = (n) => `$${n.toFixed(3)}`;
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : 'n/a');

export const DELIVERED = ['ready_for_review', 'merged'];
export const WAITING = ['parked', 'awaiting_spec_approval', 'needs_human', 'ready_for_review'];

// Numbers for real work only; eval runs are reported by `factory eval`.
export function computeMetrics(runs = listRuns().filter((r) => !r.eval)) {
  const byStatus = {};
  const stages = {};
  const repos = {};
  for (const run of runs) {
    byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;
    const repo = (repos[run.repoName ?? 'demo'] ??= { runs: 0, delivered: 0, costUsd: 0 });
    repo.runs += 1;
    repo.costUsd += run.costUsd;
    if (DELIVERED.includes(run.status)) repo.delivered += 1;
    for (const e of run.events) {
      const s = (stages[e.stage] ??= { calls: 0, costUsd: 0, ms: 0 });
      s.calls += 1;
      s.costUsd += e.costUsd ?? 0;
      s.ms += e.durationMs ?? 0;
    }
  }
  const delivered = runs.filter((r) => DELIVERED.includes(r.status));
  const unaided = delivered.filter((r) => !r.events.some((e) => e.stage === 'human'));
  const total = runs.reduce((sum, r) => sum + r.costUsd, 0);
  return {
    runs: runs.length,
    byStatus,
    stages,
    repos,
    delivered: delivered.length,
    unaided: unaided.length,
    merged: byStatus.merged ?? 0,
    totalCost: total,
    costPerDelivered: delivered.length ? total / delivered.length : null,
    avgAttempts: delivered.length ? delivered.reduce((s, r) => s + r.iteration, 0) / delivered.length : null,
    efficiency: total && delivered.length ? delivered.length / total : null,
  };
}

export function printMetrics() {
  const m = computeMetrics();
  if (!m.runs) return console.log('No runs yet.');
  console.log(`Runs: ${m.runs}   ${Object.entries(m.byStatus).map(([k, v]) => `${k}: ${v}`).join('   ')}`);
  console.log(`Delivered: ${pct(m.delivered, m.runs)}   without human help: ${pct(m.unaided, m.runs)}   merged: ${m.merged}`);
  console.log(`Total cost: ${usd(m.totalCost)}`);
  if (m.delivered) {
    console.log(`Cost per delivered change: ${usd(m.costPerDelivered)}`);
    console.log(`Avg attempts per delivered change: ${m.avgAttempts.toFixed(1)}`);
    console.log(`Factory efficiency (delivered changes per $): ${m.efficiency?.toFixed(2) ?? 'n/a'}`);
  }
  console.log('\nBy repo:');
  console.table(Object.fromEntries(Object.entries(m.repos).map(([k, r]) => [k, { runs: r.runs, delivered: r.delivered, cost: usd(r.costUsd) }])));
  console.log('By stage:');
  console.table(
    Object.fromEntries(Object.entries(m.stages).map(([k, s]) => [k, { calls: s.calls, cost: usd(s.costUsd), minutes: +(s.ms / 60000).toFixed(1) }])),
  );
}
