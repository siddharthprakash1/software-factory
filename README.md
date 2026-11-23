# Software factory

A minimal local software factory: an issue goes in, a tested and reviewed branch comes out, and every step is logged with its cost.

```
issue -> triage -> [spec -> human approval] -> implement -> verify -> review -> deliver
                                                   ^           |         |
                                                   +-----------+---------+   (feedback, up to maxIterations)
```

| Stage | What runs | Outcome |
|---|---|---|
| triage | read-only agent, cheap model | `automate`, `needs_spec` or `park`, plus a complexity rating |
| spec | read-only agent | writes `spec.md`, then the run pauses for a human |
| implement | agent with edit and shell tools, in its own git worktree | model chosen by complexity; the factory commits |
| verify | the commands in `verify` (no agent) | failure output goes back to implement |
| review | read-only agent that did not write the code | `approve`, or comments that go back to implement |
| deliver | no agent | `report.md` and a ready branch; a PR with `--pr` |

## Quick start

Needs Node 22+, git, and the [`claude` CLI](https://claude.com/claude-code) signed in. There are no dependencies to install.

```sh
npm run demo
```

This creates a throwaway demo repository in `.factory/demo-repo` and runs the first sample issue through the factory. Agent calls cost money; the sample issue costs roughly $0.10 to $0.15.

## Commands

```sh
npm run factory -- run <issue> [--repo <path>] [--pr]
npm run factory -- resume <run-id> [--feedback "guidance"]
npm run status
npm run factory -- status <run-id>
npm run metrics
```

- `run` takes a markdown file (first line is the title) or a GitHub issue as `gh:owner/repo#123`.
- `--repo <path>` points a run at another repository; the default is `repo` in `factory.config.mjs`.
- `--pr` pushes the branch and opens a pull request with `gh` when the run is delivered.
- `resume` continues a paused run: it approves a spec, or gives a stuck run guidance, fresh attempts and another budget tranche.

A run pauses with status `needs_human` when it hits `maxIterations`, the budget, or an agent error. Its worktree in `.factory/workspaces/<run-id>` is a normal checkout, so a person can also open it and finish the work by hand.

## Project layout

```
factory.config.mjs      the factory as code: target repo, limits, checks, and the
                        harness, model and tools for each stage
src/
  cli.mjs               command-line entry point
  pipeline.mjs          the stages and the loop that drives a run
  agents/
    harness.mjs         launches agents (claude built in; others via config)
    prompts.mjs         the prompt for each stage
  workspace.mjs         git worktrees, commits, check commands
  deliver.mjs           report and optional pull request
  issues.mjs            loads issues from files or GitHub
  runs.mjs              run state and event log
  metrics.mjs           aggregate numbers across runs
  paths.mjs             where everything lives
scripts/
  setup-demo.mjs        creates the demo repository
examples/
  demo-repo/            a tiny library for the factory to work on
  issues/               sample issues: a bug, a feature, a vague one, one needing a spec
.factory/               generated, not committed
  runs/<run-id>/        run.json, each agent's output, verify.log, spec.md, report.md
  workspaces/<run-id>/  the worktree for each run
  demo-repo/            the demo repository
```

## Configuration

Everything that shapes the factory is in `factory.config.mjs`:

- `repo` - the repository to work on.
- `maxIterations`, `budgetUsd`, `agentTimeoutMin` - per-run limits.
- `verify` - commands that must pass, such as `npm test`.
- `stages` - harness, model and allowed tools per stage. `implement.model` maps triage complexity to a model.
- `harnesses` - extra agent CLIs, defined as a command that reads the prompt on stdin.

## Not built yet

- Cloud sandboxes: agents run on this machine, isolated only by a git worktree.
- Triggers: nothing watches GitHub, Slack or Linear; runs are started by hand.
- A monitor agent that files new issues after shipping.
- Memory and self-improvement loops; metrics exist, evals and experiments do not.
- `--pr`, `gh:` issues and non-Claude harnesses are written but have not been exercised.

## Background

The design follows Zach Lloyd's "The guide to software factories".
