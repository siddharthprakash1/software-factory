// Builds a throwaway world for one test: a target git repository with a bare "origin", a config
// file, a data directory, a scripted fake `claude` and a fake `gh`. The factory is then driven
// through its real CLI as a subprocess, so the tests exercise exactly what a user runs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const json = (v) => '```json\n' + JSON.stringify(v) + '\n```';

// Ready-made agent replies.
export const reply = {
  automate: (complexity = 'low') => ({ text: json({ decision: 'automate', complexity, reason: 'clear', plan: 'edit app.txt' }) }),
  needsSpec: () => ({ text: json({ decision: 'needs_spec', complexity: 'medium', reason: 'design needed', plan: 'questions' }) }),
  park: () => ({ text: json({ decision: 'park', complexity: 'low', reason: 'too vague.', plan: 'Which screen?' }) }),
  write: (content) => ({ text: 'done', write: { 'app.txt': content } }),
  approve: () => ({ text: json({ verdict: 'approve', summary: 'looks right', comments: [] }) }),
  reject: (comment) => ({ text: json({ verdict: 'request_changes', summary: 'not yet', comments: [comment] }) }),
};

export function world(scenario, { config = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-test-'));
  const target = path.join(dir, 'target');
  const origin = path.join(dir, 'origin.git');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'app.txt'), 'original\n');
  // The repo's "test suite": passes only when app.txt contains the word "fixed".
  fs.writeFileSync(path.join(target, 'check.mjs'), "import fs from 'node:fs';\nif (!fs.readFileSync('app.txt', 'utf8').includes('fixed')) { console.error('app.txt is not fixed'); process.exit(1); }\nconsole.log('ok');\n");
  fs.mkdirSync(path.join(target, 'test'));
  fs.writeFileSync(path.join(target, 'test', 'app.test.txt'), 'a test\n');
  git(target, 'init', '-q', '-b', 'main');
  git(target, 'add', '-A');
  git(target, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  git(dir, 'init', '-q', '--bare', 'origin.git');
  git(target, 'remote', 'add', 'origin', origin);
  git(target, 'push', '-q', '-u', 'origin', 'main');

  const stage = (extra = {}) => ({ harness: 'claude', model: 'haiku', tools: [], ...extra });
  const cfg = {
    repos: { t: { path: target, github: 'me/t', verify: ['node check.mjs'], signals: ['node check.mjs'] } },
    defaultRepo: 't',
    label: 'factory',
    trustedAuthors: ['OWNER', 'MEMBER', 'COLLABORATOR'],
    maxIterations: 3,
    budgetUsd: 3,
    agentTimeoutMin: 1,
    memory: true,
    harnesses: {},
    stages: {
      triage: stage(),
      spec: stage(),
      implement: stage({ model: { low: 'haiku', medium: 'sonnet', high: 'opus' }, write: true }),
      review: stage(),
      verify_ui: stage(),
      learn: stage(),
      monitor: stage(),
      retro: stage(),
    },
    variants: { default: {} },
    ...config,
  };
  const configFile = path.join(dir, 'factory.config.mjs');
  fs.writeFileSync(configFile, `export default ${JSON.stringify(cfg, null, 2)};\n`);

  const scenarioFile = path.join(dir, 'scenario.json');
  fs.writeFileSync(scenarioFile, JSON.stringify(scenario));
  const ghFile = path.join(dir, 'github.json');
  fs.writeFileSync(ghFile, JSON.stringify({ next: 1, items: {} }));
  const issueFile = path.join(dir, 'issue.md');
  fs.writeFileSync(issueFile, '# Fix the app\n\nMake app.txt say fixed.\n');

  const env = {
    ...process.env,
    FACTORY_CONFIG: configFile,
    FACTORY_DATA: path.join(dir, 'data'),
    FACTORY_MEMORY: path.join(dir, 'memory'),
    FACTORY_CLAUDE: path.join(ROOT, 'test', 'fakes', 'claude.mjs'),
    FACTORY_GH: path.join(ROOT, 'test', 'fakes', 'gh.mjs'),
    FAKE_SCENARIO: scenarioFile,
    FAKE_GH_STATE: ghFile,
  };
  const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);

  return {
    dir,
    target,
    issueFile,
    git,
    // Runs the factory CLI; returns { code, out }.
    factory(...args) {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'src', 'cli.mjs'), ...args], { env, encoding: 'utf8', cwd: dir });
      return { code: r.status, out: r.stdout + r.stderr };
    },
    runs() {
      const runsDir = path.join(dir, 'data', 'runs');
      if (!fs.existsSync(runsDir)) return [];
      return fs.readdirSync(runsDir).sort().map((id) => readJson(path.join(runsDir, id, 'run.json')));
    },
    run() {
      return this.runs().at(-1);
    },
    // Every call made to the fake agent: [{ stage, model, prompt, cwd }].
    calls: (stage) => readJson(`${scenarioFile}.calls.json`, []).filter((c) => !stage || c.stage === stage),
    memory: () => (fs.existsSync(path.join(dir, 'memory', 't.md')) ? fs.readFileSync(path.join(dir, 'memory', 't.md'), 'utf8') : null),
    github: {
      state: () => readJson(ghFile),
      update(fn) {
        const s = readJson(ghFile);
        fn(s);
        fs.writeFileSync(ghFile, JSON.stringify(s, null, 2));
      },
      addIssue(title, body, labels = ['factory']) {
        let number;
        this.update((s) => {
          number = s.next++;
          s.items[number] = { kind: 'issue', state: 'OPEN', title, body, labels, comments: [] };
        });
        return number;
      },
      addComment(number, body, author_association = 'OWNER') {
        // Stamped slightly in the future so it is unambiguously newer than the run's last-seen time.
        const created_at = new Date(Date.now() + 1000).toISOString();
        this.update((s) => s.items[number].comments.push({ created_at, author_association, body }));
      },
    },
    stages: (run) => run.events.map((e) => e.stage),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }),
  };
}
