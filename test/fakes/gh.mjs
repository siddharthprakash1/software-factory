// Stand-in for the `gh` CLI, backed by a JSON file (FAKE_GH_STATE) that plays the part of GitHub:
// { "next": 1, "items": { "<number>": { kind: "issue"|"pr", title, body, labels, state, comments } } }
// Issues and pull requests share one number sequence, as they do on GitHub.
import fs from 'node:fs';

const file = process.env.FAKE_GH_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2));
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const flags = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const stdin = () => fs.readFileSync(0, 'utf8');
const out = (v) => process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v));
const repo = flag('--repo');
const url = (kind, n) => `https://github.com/${repo}/${kind === 'pr' ? 'pull' : 'issues'}/${n}`;
const [a, b, c] = args;

function create(kind, fields) {
  const number = state.next++;
  state.items[number] = { kind, state: 'OPEN', labels: [], comments: [], ...fields };
  save();
  return number;
}

if (a === 'issue' && b === 'view') {
  const i = state.items[c];
  out({ title: i.title, body: i.body, url: url('issue', c) });
} else if (a === 'issue' && b === 'list') {
  const label = flag('--label');
  const open = Object.entries(state.items).filter(([, i]) => i.kind === 'issue' && i.state === 'OPEN' && (!label || i.labels.includes(label)));
  out(open.map(([number, i]) => ({ number: Number(number), title: i.title })));
} else if (a === 'issue' && b === 'comment') {
  state.items[c].comments.push({ created_at: new Date().toISOString(), author_association: 'OWNER', body: stdin() });
  save();
} else if (a === 'issue' && b === 'create') {
  out(url('issue', create('issue', { title: flag('--title'), body: stdin(), labels: flags('--label') })));
} else if (a === 'label') {
  // nothing to do
} else if (a === 'api') {
  const m = args.at(-1).match(/(issues|pulls)\/(\d+)\/(comments|reviews)$/);
  out(m && m[1] === 'issues' ? state.items[m[2]]?.comments ?? [] : []);
} else if (a === 'pr' && b === 'create') {
  out(url('pr', create('pr', { title: flag('--title'), body: stdin(), head: flag('--head'), base: flag('--base') })));
} else if (a === 'pr' && b === 'view') {
  const i = state.items[c];
  out({ state: i.state, mergedAt: i.mergedAt ?? null, closedAt: i.closedAt ?? null });
} else if (a === 'pr' && b === 'edit') {
  (state.items[c].labels ??= []).push(flag('--add-label'));
  save();
} else if (a === 'pr' && b === 'merge') {
  state.items[c].autoMerge = args.includes('--auto');
  save();
} else if (a === 'pr' && b === 'list') {
  const q = flag('--search') ?? '';
  const merged = Object.entries(state.items).filter(([, i]) => i.kind === 'pr' && i.state === 'MERGED' && q.includes(i.title.replace(/^Revert "|"$/g, '')) && i.title.startsWith('Revert "'));
  out(merged.map(([number, i]) => ({ number: Number(number), title: i.title })));
} else if (a === 'run' && b === 'list') {
  out(state.failedRuns ?? []);
} else if (a === 'run' && b === 'view') {
  out('log of the failed run');
} else {
  process.stderr.write(`fake gh: unsupported command: ${args.join(' ')}\n`);
  process.exit(1);
}
