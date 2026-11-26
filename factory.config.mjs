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
  //   protected path prefixes agents may not change (.github/, .claude/ and agent instruction
  //           files such as CLAUDE.md and AGENTS.md are always protected)
  //   testFiles command that runs only some test files, with {files} where they go. The factory
  //           uses it to run new tests against the original code. Without it, verify is used.
  //   failToPass false turns that check off for a repository
  //   autoMerge  true lets low-risk PRs merge once required checks pass (off unless set)
  //   risk       { lines, files, paths } tunes what counts as low risk
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
      testFiles: 'uv run pytest -q {files}',
      signals: ['uv run pytest -q'],
    },
  },
  defaultRepo: 'demo',

  // GitHub issues carrying this label are picked up by `factory poll`.
  label: 'factory',

  // Whose comments may steer a run (GitHub author associations). Everyone else is ignored,
  // because a comment becomes instructions to an agent that can run commands.
  trustedAuthors: ['OWNER', 'MEMBER', 'COLLABORATOR'],

  // How many new issues `poll` works on at the same time.
  concurrency: 2,

  // Hard limits per run.
  maxIterations: 3, // implement -> verify -> review attempts before asking a human
  budgetUsd: 3, // stop and ask a human once a run has spent this much
  agentTimeoutMin: 20,
  agentBudgetUsd: 1, // hard cap on any single agent call (claude --max-budget-usd)

  // Refuse to run agents on a Claude Code older than this. 2.1.163 fixed a data-exfiltration bug.
  minClaudeVersion: '2.1.163',

  // Lessons from review rejections, failed checks and human feedback are kept in
  // memory/<repo>.md and given to later runs on the same repo.
  memory: true,
  // New lessons are written to memory/<repo>.pending.md and only used once a person runs
  // `factory lessons <repo> --approve`. A lessons file is instructions to every later run.
  memoryReview: true,

  // Run every agent and every test command in a throwaway Docker container that sees only the
  // run's worktree. Build the image once with `npm run sandbox:build`. Agents in the container
  // need their own model access: run `claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN.
  sandbox: {
    enabled: true,
    image: 'software-factory-agent',
    memory: '4g',
    cpus: 4,
  },

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
    // The browser check drives a browser on the host, so it runs outside the sandbox.
    verify_ui: { harness: 'claude', model: 'sonnet', tools: BROWSER, sandbox: false },
    learn: { harness: 'claude', model: 'haiku', tools: [] },
    monitor: { harness: 'claude', model: 'sonnet', tools: READ },
    retro: { harness: 'claude', model: 'sonnet', tools: [] },
  },

  // Named overrides for `factory eval <suite> --variant a,b`. Each is merged over this config.
  variants: {
    default: {},
    'review-sonnet': { stages: { review: { model: 'sonnet' } } },
    'all-haiku': { stages: { implement: { model: 'haiku' }, review: { model: 'haiku' } } },
    // The least plan usage a run can take: Haiku everywhere, two attempts at most, a small
    // budget per call and per run, and no lessons step.
    cheapest: {
      maxIterations: 2,
      budgetUsd: 1,
      agentBudgetUsd: 0.4,
      memory: false,
      stages: {
        spec: { model: 'haiku' },
        implement: { model: 'haiku' },
        review: { model: 'haiku' },
      },
    },
  },
};
