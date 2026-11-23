// Factory-as-code: everything that shapes how the factory behaves lives here.
// Change a model, a tool list or a limit, run `factory eval`, and compare the numbers.

const READ = ['Read', 'Glob', 'Grep', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'];
const WRITE = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'];
const BROWSER = ['Read', 'Glob', 'Grep', 'mcp__plugin_playwright_playwright'];

export default {
  // Repositories the factory works on. Pick one per run with --repo <name>.
  //   path    local checkout (relative to this file)
  //   github  owner/name; enables issue triggers, PRs and comment steering
  //   verify  commands that must pass after every implementation attempt
  //   ui      optional browser check: a start command and the URL it serves
  //   signals commands the monitor runs; a failing one becomes a proposed issue
  repos: {
    demo: {
      path: './.factory/demo-repo',
      verify: ['npm test'],
      signals: ['npm test'],
    },
    'demo-site': {
      path: './.factory/demo-site',
      verify: ['npm test'],
      ui: { start: 'node server.mjs', url: 'http://localhost:4173' },
    },
    surety: {
      path: './.factory/repos/surety',
      github: 'siddharthprakash1/surety',
      verify: ['uv run pytest -q'],
      signals: ['uv run pytest -q'],
    },
  },
  defaultRepo: 'demo',

  // GitHub issues carrying this label are picked up by `factory poll`.
  label: 'factory',

  // Hard limits per run.
  maxIterations: 3, // implement -> verify -> review attempts before asking a human
  budgetUsd: 3, // stop and ask a human once a run has spent this much
  agentTimeoutMin: 20,

  // Lessons from review rejections, failed checks and human feedback are kept in
  // memory/<repo>.md and given to later runs on the same repo.
  memory: true,

  // Harnesses: how an agent is launched. `claude` is built in.
  // Add others as a command that reads the prompt on stdin and prints its answer:
  //   codex: { command: 'codex', args: ['exec', '--model', '{model}', '-'] }
  harnesses: {},

  // One entry per stage: which harness, which model, which tools.
  // A model can be a name or a map from triage complexity to a name.
  stages: {
    triage: { harness: 'claude', model: 'haiku', tools: READ },
    spec: { harness: 'claude', model: 'sonnet', tools: READ },
    implement: {
      harness: 'claude',
      model: { low: 'haiku', medium: 'sonnet', high: 'opus' },
      tools: WRITE,
      write: true,
    },
    review: { harness: 'claude', model: { low: 'haiku', medium: 'sonnet', high: 'sonnet' }, tools: READ },
    verify_ui: { harness: 'claude', model: 'sonnet', tools: BROWSER },
    learn: { harness: 'claude', model: 'haiku', tools: [] },
    monitor: { harness: 'claude', model: 'sonnet', tools: READ },
  },

  // Named overrides for `factory eval <suite> --variant a,b`. Each is merged over this config.
  variants: {
    default: {},
    'review-sonnet': { stages: { review: { model: 'sonnet' } } },
    'all-haiku': { stages: { implement: { model: 'haiku' }, review: { model: 'haiku' } } },
  },
};
