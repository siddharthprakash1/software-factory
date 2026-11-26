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
  // Help means a person steered the work. Merging, closing or reverting the PR afterwards is a
  // decision about the result, not help with it.
  const steered = (e) => e.stage === 'human' && !/^pr (merged|closed)$|^merged change was reverted$/.test(e.outcome);
  const unaided = delivered.filter((r) => !r.events.some(steered));
  const total = runs.reduce((sum, r) => sum + r.costUsd, 0);
  // Outcomes of pull requests that a person has decided on.
  const decided = runs.filter((r) => r.pr && ['merged', 'closed'].includes(r.status));
  const merged = decided.filter((r) => r.status === 'merged');
  const reverted = merged.filter((r) => r.reverted);
  const kinds = {};
  for (const r of decided) {
    const k = (kinds[r.triage?.kind ?? 'unknown'] ??= { decided: 0, merged: 0 });
    k.decided += 1;
    if (r.status === 'merged') k.merged += 1;
  }
  const hours = merged
    .map((r) => (Date.parse(r.mergedAt) - Date.parse(r.events.find((e) => e.stage === 'deliver')?.at ?? r.startedAt)) / 3.6e6)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const closeReasons = {};
  for (const r of decided.filter((r) => r.status === 'closed')) {
    const key = r.closedReason ? r.closedReason.split('\n')[0].slice(0, 80) : 'no reason given';
    closeReasons[key] = (closeReasons[key] ?? 0) + 1;
  }
  const prCost = runs.filter((r) => r.pr).reduce((s, r) => s + r.costUsd, 0);
  return {
    decided: decided.length,
    mergeRate: decided.length ? merged.length / decided.length : null,
    revertRate: merged.length ? reverted.length / merged.length : null,
    reverted: reverted.length,
    costPerMerged: merged.length ? prCost / merged.length : null,
    medianHoursToMerge: hours.length ? hours[Math.floor(hours.length / 2)] : null,
    kinds,
    closeReasons,
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
  if (m.decided) {
    console.log(`\nPull requests decided by a person: ${m.decided}   merge rate: ${pct(m.mergeRate * m.decided, m.decided)}   reverted: ${m.reverted}${m.revertRate != null ? ` (${pct(m.reverted, m.mergeRate * m.decided)})` : ''}`);
    if (m.costPerMerged != null) console.log(`Cost per merged PR (all PR runs' cost / merged): ${usd(m.costPerMerged)}`);
    if (m.medianHoursToMerge != null) console.log(`Median time from PR to merge: ${m.medianHoursToMerge.toFixed(1)} h`);
    console.log('Merge rate by kind of work:');
    console.table(Object.fromEntries(Object.entries(m.kinds).map(([k, v]) => [k, { decided: v.decided, merged: v.merged, rate: pct(v.merged, v.decided) }])));
    if (Object.keys(m.closeReasons).length) {
      console.log('Why PRs were closed:');
      for (const [reason, n] of Object.entries(m.closeReasons).sort((a, b) => b[1] - a[1])) console.log(`  ${n} x ${reason}`);
    }
  }
  console.log('\nBy repo:');
  console.table(Object.fromEntries(Object.entries(m.repos).map(([k, r]) => [k, { runs: r.runs, delivered: r.delivered, cost: usd(r.costUsd) }])));
  console.log('By stage:');
  console.table(
    Object.fromEntries(Object.entries(m.stages).map(([k, s]) => [k, { calls: s.calls, cost: usd(s.costUsd), minutes: +(s.ms / 60000).toFixed(1) }])),
  );
}
