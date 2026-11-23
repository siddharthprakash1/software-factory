# Software factory

A small software factory: label a GitHub issue, and a tested, reviewed pull request comes back. Every step is logged with its cost, people steer by commenting, and the factory keeps lessons per repository.

```
issue -> triage -> [spec -> human approval] -> implement -> verify -> [browser check] -> review -> deliver
            |                                      ^           |             |             |
            +-> park (asks for details)            +-----------+-------------+-------------+
                                                     feedback, up to maxIterations
```

| Stage | What runs | Outcome |
|---|---|---|
| triage | read-only agent, cheap model | `automate`, `needs_spec` or `park`, plus a complexity rating |
| spec | read-only agent | writes a spec, then waits for a person to approve it |
| implement | agent with edit and shell tools, in its own git worktree | model chosen by complexity; the factory commits |
| verify | the repo's `verify` commands (no agent) | failure output goes back to implement |
| browser check | optional; starts the app and an agent uses it in a real browser | pass, or problems that go back to implement |
| review | read-only agent that did not write the code | `approve`, or comments that go back to implement |
| deliver | no agent | a report and a branch, or a pull request |
| learn | cheap agent, after a run that received feedback | updates `memory/<repo>.md` |

## Proof

[`docs/proof/`](docs/proof/README.md) records the factory's first real runs: two pull requests on a private repository, a revision driven by a PR comment, eval results, screenshots, raw logs and what it cost.

## Quick start

Needs Node 22+, git, the [`claude` CLI](https://claude.com/claude-code) signed in, and `gh` for anything touching GitHub. There are no dependencies to install.

```sh
npm run demo
```

This creates throwaway demo repositories under `.factory/` and runs a sample issue. Agent calls cost money; a small issue costs a few cents.

## Working on a real repository

1. Clone it somewhere and add it to `repos` in `factory.config.mjs` with its `github` slug and `verify` commands.
2. Label an issue `factory`.
3. Run the poller:

```sh
npm run factory -- poll --watch 60
```

Each pass of `poll` does three things:

- **New issues** with the label are taken through the pipeline and delivered as a pull request that closes the issue.
- **New comments** from people steer waiting runs. A reply on a parked issue re-triages it with the added details, a reply to a posted spec approves or amends it, and a comment or review on a factory PR sends it back to implement and updates the same PR.
- **Merged or closed PRs** close out their run.

The factory reports on the issue at each stop: the PR link, the spec to approve, the questions that got it parked, or why it is stuck.

## Commands

```sh
npm run factory -- run <issue> [--repo <name|path>] [--path <checkout>] [--pr]
npm run factory -- resume <run-id> [--feedback "guidance"]
npm run factory -- poll [--watch <seconds>]
npm run factory -- monitor [--repo <name>] [--auto] [--signal "cmd"]
npm run factory -- eval <suite.json> [--variant a,b]
npm run factory -- status [run-id]
npm run factory -- metrics
npm run factory -- dashboard [--serve <port>]
```

- `run` takes a markdown file (first line is the title), `<repo>#123`, or `gh:owner/repo#123`.
- `resume` is the local equivalent of commenting: answer a parked run, approve a spec, unblock a stuck run, or revise a delivered one.
- `monitor` runs the repo's `signals` commands and reads failed CI runs. If something is failing, an agent finds the cause and files an issue labelled `factory-proposed` (or writes it to `.factory/inbox/` for repos without GitHub). `--auto` also adds the trigger label so the factory picks it up.
- `eval` runs every case of a suite against each named variant from `config.variants` and prints delivery rate, hidden acceptance-test results, cost and time side by side.
- `dashboard` shows what is waiting on a person, all runs, cost by stage and repo, and the lessons learned.

A run stops with status `needs_human` when it hits `maxIterations`, the budget, or an agent error. Its worktree in `.factory/workspaces/<run-id>` is a normal checkout, so a person can also finish the work by hand.

## Memory

When a run receives feedback (a failed check, a review rejection, a browser-check failure or a human comment), the learn stage distils it into short rules in `memory/<repo>.md`. Triage, implement and review read that file on later runs. The files are plain markdown and committed, so they can be read, edited or deleted by hand.

## Evals

A suite lists issues and, per issue, a hidden acceptance test the agents never see:

```sh
npm run factory -- eval examples/evals/demo.json --variant default,review-sonnet,all-haiku
```

Use it before changing a model, prompt or tool list in the config. Eval runs do not read or write memory and are left out of `metrics`.

## GitHub Actions

`templates/github-workflow.yml` runs the factory on a GitHub runner when an issue is labelled. Copy it into the target repository and add the two secrets it names. It has not been run yet, and it handles the initial run only: comment steering needs the poller on a machine that keeps `.factory/`.

## Project layout

```
factory.config.mjs      the factory as code: repos, limits, stages, eval variants
memory/<repo>.md        lessons learned per repository
src/
  cli.mjs               command-line entry point
  pipeline.mjs          the stages, the loop, resume
  agents/harness.mjs    launches agents (claude built in; others via config)
  agents/prompts.mjs    the prompt for each stage
  poll.mjs              GitHub trigger and comment steering
  github.mjs            issues, comments, labels, PRs through gh
  notify.mjs            reports run outcomes on the issue and PR
  memory.mjs            reads and updates lessons
  monitor.mjs           health signals -> proposed issues
  evals.mjs             suites, variants, acceptance checks
  ui-verify.mjs         starts and stops the app for the browser check
  dashboard.mjs         HTML dashboard
  workspace.mjs  deliver.mjs  issues.mjs  runs.mjs  metrics.mjs  config.mjs  paths.mjs
scripts/setup-demo.mjs  creates the demo repositories
templates/              GitHub Actions workflow for target repositories
examples/               demo-repo, demo-site, sample issues, an eval suite
.factory/               generated, not committed: runs, worktrees, clones, inbox, eval results
```

## Limits

- Agents run on the machine that runs the factory, isolated only by a git worktree. There is no sandbox.
- The browser check relies on the Playwright MCP server being available to the `claude` CLI.
- Non-Claude harnesses are supported by the config but have not been exercised.
- The monitor's GitHub path (reading failed CI runs, filing issues) and the Actions workflow have not been exercised.

## Background

The design follows Zach Lloyd's "The guide to software factories"; the memory loop follows the "knowledge factory" idea from LangChain.
