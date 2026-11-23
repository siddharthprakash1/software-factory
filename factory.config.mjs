// Factory-as-code: everything that shapes how the factory behaves lives here.
// Change a model, a tool list or a limit, rerun the same issues, and compare `metrics`.

const READ = ['Read', 'Glob', 'Grep', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'];
const WRITE = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'];

export default {
  // Target repository the factory works on (override per run with --repo).
  repo: './.factory/demo-repo',

  // Hard limits per run.
  maxIterations: 3, // implement -> verify -> review attempts before asking a human
  budgetUsd: 3, // stop and ask a human once a run has spent this much
  agentTimeoutMin: 20,

  // Deterministic checks run in the worktree after every implementation attempt.
  verify: ['npm test'],

  // Harnesses: how an agent is launched. `claude` is built in.
  // Add others as a command that reads the prompt on stdin and prints its answer:
  //   codex: { command: 'codex', args: ['exec', '--model', '{model}', '-'] }
  harnesses: {},

  // One entry per stage: which harness, which model, which tools.
  // `implement.model` is routed by the complexity the triage agent assigns.
  stages: {
    triage: { harness: 'claude', model: 'haiku', tools: READ },
    spec: { harness: 'claude', model: 'sonnet', tools: READ },
    implement: {
      harness: 'claude',
      model: { low: 'haiku', medium: 'sonnet', high: 'opus' },
      tools: WRITE,
      write: true,
    },
    review: { harness: 'claude', model: 'sonnet', tools: READ },
  },
};
