import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { DATA, MEMORY } from './paths.mjs';
import { listRuns } from './runs.mjs';
import { computeMetrics, WAITING } from './metrics.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Small runs cost fractions of a cent, so show three decimals below a dollar.
const usd = (n) => `$${n.toFixed(Math.abs(n) < 1 ? 3 : 2)}`;
const LABEL = {
  running: 'Running',
  parked: 'Parked',
  awaiting_spec_approval: 'Spec needs approval',
  needs_human: 'Stuck',
  ready_for_review: 'Ready for review',
  merged: 'Merged',
  closed: 'Closed',
};
const TONE = { running: 'info', parked: 'muted', awaiting_spec_approval: 'warn', needs_human: 'bad', ready_for_review: 'good', merged: 'good', closed: 'muted' };

const CSS = `
:root{--bg:#f7f7f5;--card:#fff;--ink:#1c1d1f;--dim:#6b6f76;--line:#e4e4e0;--good:#1a7f4b;--warn:#a15c00;--bad:#b3261e;--info:#1f5fbf;--bar:#3b6fd4}
@media(prefers-color-scheme:dark){:root{--bg:#131416;--card:#1c1e21;--ink:#ececec;--dim:#9a9fa6;--line:#2c2f33;--good:#5fd08f;--warn:#e7a94a;--bad:#f2867f;--info:#7fb0ff;--bar:#6c9bf0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:28px 0 10px;color:var(--dim);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.sub{color:var(--dim);margin:2px 0 20px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.tile b{display:block;font-size:24px;font-variant-numeric:tabular-nums}.tile span{color:var(--dim)}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--dim);font-weight:600;font-size:12px}tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}a{color:var(--info)}
.chip{font-size:12px;font-weight:600;white-space:nowrap}.good{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}.info{color:var(--info)}.muted{color:var(--dim)}
.note{color:var(--dim);font-size:12px;max-width:520px;white-space:pre-wrap}.bar{height:8px;border-radius:4px;background:var(--bar);min-width:2px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}pre{white-space:pre-wrap;margin:0;font:12px/1.5 ui-monospace,monospace}
`;

function runRow(run) {
  const mins = run.endedAt ? ((new Date(run.endedAt) - new Date(run.startedAt)) / 60000).toFixed(1) : '';
  const title = run.issue.url ? `<a href="${esc(run.issue.url)}">${esc(run.issue.title)}</a>` : esc(run.issue.title);
  const pr = run.pr ? ` · <a href="${esc(run.pr)}">PR</a>` : '';
  return `<tr><td><span class="chip ${TONE[run.status] ?? 'muted'}">${LABEL[run.status] ?? esc(run.status)}</span></td>
<td>${esc(run.repoName ?? 'demo')}</td><td>${title}${pr}<div class="note">${esc(run.id)}</div></td>
<td class="n">${run.iteration}</td><td class="n">${usd(run.costUsd)}</td><td class="n">${mins}</td></tr>`;
}

export function renderDashboard() {
  const all = listRuns();
  const runs = all.filter((r) => !r.eval).reverse();
  const m = computeMetrics();
  const waiting = runs.filter((r) => WAITING.includes(r.status));
  const running = runs.filter((r) => r.status === 'running');
  // Each running run, step by step: which model each agent call used and what it cost so far.
  const step = (e) => `<tr><td>${esc(e.stage)}</td><td>${esc(e.model ?? '')}</td><td>${esc(e.outcome)}</td><td class="n">${e.costUsd != null ? usd(e.costUsd) : ''}</td><td class="n">${e.durationMs != null ? Math.round(e.durationMs / 1000) + ' s' : ''}</td></tr>`;
  const live = (r) => `<div class="card" style="margin-bottom:12px"><b>${esc(r.issue.title)}</b> <span class="muted">· ${esc(r.repoName ?? '')} · attempt ${r.iteration} · ${usd(r.costUsd)} so far · started ${new Date(r.startedAt).toLocaleTimeString()}</span>
<div class="wrap" style="margin-top:10px"><table><tr><th>Step</th><th>Model</th><th>Outcome</th><th class="n">Cost</th><th class="n">Time</th></tr>${r.events.map(step).join('')}<tr><td colspan="5" class="info">working on the next step…</td></tr></table></div></div>`;
  const maxStage = Math.max(...Object.values(m.stages).map((s) => s.costUsd), 0.0001);
  const lessons = fs.existsSync(MEMORY) ? fs.readdirSync(MEMORY).filter((f) => f.endsWith('.md')) : [];
  const tile = (value, label) => `<div class="tile"><b>${value}</b><span>${label}</span></div>`;
  const head = '<tr><th>Status</th><th>Repo</th><th>Issue</th><th class="n">Attempts</th><th class="n">Cost</th><th class="n">Minutes</th></tr>';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="${running.length ? 5 : 15}"><title>Software factory</title><style>${CSS}</style></head><body><main>
<h1>Software factory</h1><p class="sub">${m.runs} runs · updated ${new Date().toLocaleTimeString()} · refreshes every ${running.length ? 5 : 15} s${all.length - runs.length ? ` · ${all.length - runs.length} eval runs not shown` : ''}</p>
<div class="tiles">
${tile(m.runs, 'runs')}
${tile(m.runs ? `${Math.round((m.delivered / m.runs) * 100)}%` : '–', 'delivered')}
${tile(m.runs ? `${Math.round((m.unaided / m.runs) * 100)}%` : '–', 'delivered without help')}
${tile(m.merged, 'merged')}
${tile(m.mergeRate != null ? `${Math.round(m.mergeRate * 100)}%` : '–', 'merge rate')}
${tile(m.revertRate != null ? `${Math.round(m.revertRate * 100)}%` : '–', 'reverted')}
${tile(m.costPerMerged != null ? usd(m.costPerMerged) : '–', 'per merged PR')}
${tile(usd(m.totalCost), 'total cost')}
${tile(m.costPerDelivered != null ? usd(m.costPerDelivered) : '–', 'per delivered change')}
</div>
${running.length ? `<h2>Running now (${running.length})</h2>${running.map(live).join('')}` : ''}
<h2>Waiting on a person (${waiting.length})</h2>
${waiting.length ? `<div class="wrap"><table>${head}${waiting.map(runRow).join('')}</table></div>` : '<div class="card muted">Nothing is waiting.</div>'}
<div class="cols"><div><h2>Cost by stage</h2><div class="wrap"><table><tr><th>Stage</th><th class="n">Calls</th><th class="n">Cost</th><th style="width:40%"></th></tr>
${Object.entries(m.stages).filter(([, s]) => s.costUsd > 0).sort((a, b) => b[1].costUsd - a[1].costUsd).map(([k, s]) => `<tr><td>${esc(k)}</td><td class="n">${s.calls}</td><td class="n">${usd(s.costUsd)}</td><td><div class="bar" style="width:${(s.costUsd / maxStage) * 100}%"></div></td></tr>`).join('')}
</table></div></div>
<div><h2>By repo</h2><div class="wrap"><table><tr><th>Repo</th><th class="n">Runs</th><th class="n">Delivered</th><th class="n">Cost</th></tr>
${Object.entries(m.repos).map(([k, r]) => `<tr><td>${esc(k)}</td><td class="n">${r.runs}</td><td class="n">${r.delivered}</td><td class="n">${usd(r.costUsd)}</td></tr>`).join('')}
</table></div></div></div>
<h2>All runs</h2><div class="wrap"><table>${head}${runs.map(runRow).join('')}</table></div>
${lessons.length ? `<h2>Lessons learned</h2><div class="cols">${lessons.map((f) => `<div class="card"><b>${esc(f.endsWith('.pending.md') ? f.replace(/\.pending\.md$/, '') + ' (proposed, not yet approved)' : f.replace(/\.md$/, ''))}</b><pre>${esc(fs.readFileSync(path.join(MEMORY, f), 'utf8'))}</pre></div>`).join('')}</div>` : ''}
</main></body></html>`;
}

// Writes a static copy and, with a port, serves a live one.
export function dashboard({ port } = {}) {
  fs.mkdirSync(DATA, { recursive: true });
  const file = path.join(DATA, 'dashboard.html');
  fs.writeFileSync(file, renderDashboard());
  console.log(`Wrote ${file}`);
  if (!port) return;
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderDashboard());
    })
    .listen(port, '127.0.0.1', () => console.log(`Live dashboard at http://localhost:${port}`));
}
