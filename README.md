<div align="center">

# Software Factory

**Label a GitHub issue. Get back a tested, reviewed pull request.**

A small, readable software factory: a loop of AI agents that takes an issue from triage to pull request,<br>
logs what every step cost, takes direction from your comments, and learns from its mistakes.

![Node 22+](https://img.shields.io/badge/node-22%2B-3fb950)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-388bfd)
![Agents: Claude Code](https://img.shields.io/badge/agents-Claude%20Code-a371f7)
[![Tests](https://github.com/siddharthprakash1/software-factory/actions/workflows/test.yml/badge.svg)](https://github.com/siddharthprakash1/software-factory/actions/workflows/test.yml)
[![Proof: real PRs](https://img.shields.io/badge/proof-real%20pull%20requests-d29922)](docs/proof/README.md)

<img src="docs/images/pipeline.svg" alt="Pipeline: issue, triage, optional spec, implement, verify, optional browser check, review, pull request, with a feedback loop back to implement and a memory of lessons" width="100%">

</div>

## It works on a real repository

The factory was pointed at [`surety`](https://github.com/siddharthprakash1/surety), a Python research codebase with 183 tests. Two issues were labelled `factory`. It opened two pull requests, and revised one of them when a person left a review comment.

| | Issue | Pull request | Attempts | Usage at list price |
|---|---|---|---|---|
| 1 | [Metrics: NaN on empty input, ECE edge tests](https://github.com/siddharthprakash1/surety/issues/2) | [surety#3](https://github.com/siddharthprakash1/surety/pull/3) | 2 (review rejected the first) | $0.06 |
| 2 | [Supervisor parser fixes](https://github.com/siddharthprakash1/surety/issues/1) | [surety#4](https://github.com/siddharthprakash1/surety/pull/4) | 1, then 1 revision from a comment | $0.06 |

<table>
<tr>
<td width="50%" valign="top">

**The issue, with the factory's reply**

<a href="https://github.com/siddharthprakash1/surety/issues/2"><img src="docs/images/issue.jpg" alt="GitHub issue 2 on surety, labelled factory, with the factory's comment linking the pull request"></a>

</td>
<td width="50%" valign="top">

**The pull request it opened**

<a href="https://github.com/siddharthprakash1/surety/pull/3"><img src="docs/images/pull-request.jpg" alt="Pull request 3 on surety, opened by the factory, with triage and review notes and a passing test run"></a>

</td>
</tr>
</table>

**Steering by comment.** A person asked for a change on the PR (bottom). The factory picked the comment up, pushed a second commit to the same PR, and replied (top):

<div align="center">
<a href="https://github.com/siddharthprakash1/surety/pull/4"><img src="docs/images/steering.jpg" alt="Pull request 4 conversation: a human review comment, followed by the factory's new commit and its reply" width="75%"></a>
</div>

Everything behind these numbers is in **[docs/proof](docs/proof/README.md)**: full-page screenshots, raw logs, eval results, costs, and a plain list of what has not been proven.

## How it works

| Stage | What runs | Outcome |
|---|---|---|
| **Triage** | read-only agent, cheap model | `automate`, `needs_spec` or `park`, plus a complexity rating |
| **Spec** | read-only agent, only when needed | writes a spec, then waits for a person to approve it |
| **Implement** | agent with edit and shell tools, in its own git worktree | model chosen by complexity; the factory commits |
| **Guard** | plain code, no agent | blocks changes to CI config, protected paths and deleted tests |
| **Verify** | your repo's test commands, no agent | failure output goes back to implement |
| **Browser check** | optional; starts the app and an agent uses it in a real browser | pass, or problems that go back to implement |
| **Review** | read-only agent that did not write the code | `approve`, or comments that go back to implement; also flags anything the issue did not ask for |
| **Deliver** | no agent | a pull request that closes the issue |
| **Learn** | cheap agent, after a run that received feedback | updates `memory/<repo>.md` |

This is what one run looks like. The review agent rejected the first attempt, the second passed, and the lesson was saved:

```
triage     haiku   automate/low          $0.008   18s
implement  haiku   attempt 1 committed   $0.014  109s
verify             passed                         27s     uv run pytest -q
review     haiku   request_changes       $0.011   27s
implement  haiku   attempt 2 committed   $0.014   90s
verify             passed                         25s
review     haiku   approve               $0.008   20s
deliver            pr opened
learn      haiku   lessons updated       $0.005   10s
```

## What else it does

<table>
<tr>
<td width="50%" valign="top">

### People stay in charge

- A reply on a **parked issue** re-triages it with the added details.
- A reply to a **posted spec** approves or amends it.
- A comment or review on a **factory PR** sends it back to implement and updates the same PR.
- A run stops and asks for help after 3 failed attempts or when it hits its budget.
- Only people with write access to the repository can steer. Comments from anyone else are ignored, and hidden text is stripped from issues and comments before an agent sees them.

### It remembers

Failed checks, review rejections and human comments are distilled into short rules in [`memory/`](memory/), one plain markdown file per repository. Later runs read them.

### It can be measured

`factory eval` runs a suite of issues against several configurations, each with a hidden acceptance test the agents never see. `factory replay` redoes a real past run from the same commit under a different configuration. Change a model or a prompt, and compare before you trust it.

</td>
<td width="50%" valign="top">

### It checks the real app

For repos with a UI, an agent opens the running app in a browser and tries the change. This is the screenshot it took after clicking Reset on a demo counter:

<img src="docs/proof/images/browser-check-counter-reset.png" alt="Demo counter page showing 0 after the agent clicked Reset" width="70%">

### It watches for breakage

`factory monitor` runs your health checks and reads failed CI runs. When something fails, an agent finds the cause and files an issue for it.

</td>
</tr>
</table>

### A dashboard for the whole thing

What is waiting on a person, every run, cost by stage and by repository, and the lessons learned.

<div align="center">
<img src="docs/images/dashboard.jpg" alt="Dashboard showing run counts, delivery rate, total cost, runs waiting on a person, cost by stage and cost by repository" width="85%">
</div>

## Quick start

You need Node 22+, git, the [`claude` CLI](https://claude.com/claude-code) signed in, and [`gh`](https://cli.github.com) for anything that touches GitHub. There is nothing to install.

```sh
git clone https://github.com/siddharthprakash1/software-factory
cd software-factory
npm run demo
```

`npm run demo` creates two throwaway repositories under `.factory/` and runs a sample issue through the pipeline. Agent calls use your Claude plan or API key; a small issue is a few cents at list prices.

## Use it on your own repository

1. Clone the repository somewhere and add it to `repos` in [`factory.config.mjs`](factory.config.mjs):

   ```js
   myapp: {
     path: '../myapp',
     github: 'you/myapp',
     verify: ['npm test'],
   },
   ```

2. Label an issue `factory`.
3. Start the poller:

   ```sh
   npm run factory -- poll --watch 60
   ```

The factory comments on the issue at every stop: the PR link, the spec to approve, the questions that got it parked, or why it is stuck.

## Commands

| Command | What it does |
|---|---|
| `run <issue> [--repo <name>] [--pr]` | Take one issue through the pipeline. The issue is a markdown file, `<repo>#123`, or `gh:owner/repo#123`. |
| `poll [--watch <seconds>]` | Pick up labelled GitHub issues (several at once), new human comments, and merged or closed PRs. |
| `resume <run-id> [--feedback "..."]` | The local way to comment: answer, approve, unblock or revise a run. |
| `monitor [--repo <name>] [--auto]` | Check repo health and propose issues. `--auto` lets the factory pick them up itself. |
| `eval <suite.json> [--variant a,b]` | Run a suite against named variants from the config and compare them. |
| `replay <run-id> [--variant name]` | Redo a past run's issue from the same commit under a variant. Posts nothing to GitHub. |
| `status [run-id]` | List runs, or show one run's step-by-step log. |
| `metrics` | Delivery rate, cost per delivered change, cost by stage and repo. |
| `dashboard [--serve <port>]` | Write the dashboard, and optionally serve it live. |

Run any of them as `npm run factory -- <command>`.

## The factory is code

Everything that shapes behaviour is in one file, [`factory.config.mjs`](factory.config.mjs): the repositories, the limits, and for each stage the harness, model and tools. `implement` and `review` pick a model from the complexity that triage assigned. `variants` are named overrides you can test with `eval` before adopting them.

<details>
<summary><b>Project layout</b></summary>

```
factory.config.mjs      repos, limits, stages, eval variants
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
docs/proof/             evidence from the first real runs
docs/RESEARCH.md        what other factories do, and the roadmap
test/                   offline test suite with a scripted agent and a fake GitHub
.factory/               generated, not committed: runs, worktrees, clones, eval results
```

</details>

<details>
<summary><b>Running it in GitHub Actions</b></summary>

[`templates/github-workflow.yml`](templates/github-workflow.yml) runs the factory on a GitHub runner when an issue is labelled. Copy it into the target repository and add the secrets it names. It has not been run yet, and it handles the first run only: comment steering needs the poller on a machine that keeps `.factory/`.

</details>

## Tested without spending anything

`npm test` runs the real CLI against a scripted agent and a fake GitHub: 31 tests covering the pipeline, the guards, comment steering, parked issues, spec approval, the monitor and replay. They need no network and no model calls, and run on Linux and Windows in CI.

## Where this is going

[docs/RESEARCH.md](docs/RESEARCH.md) compares this factory with what Stripe, Spotify, Warp, OpenAI, Anthropic and others describe doing, and lists what to build next.

## Honest limits

- Agents run on the machine that runs the factory, isolated only by a git worktree. There is no sandbox, so point it only at repositories and issues you trust.
- The two surety PRs are open, not merged. Tests pass, but no maintainer has reviewed them yet.
- The browser check needs the Playwright MCP server available to the `claude` CLI, and has only been tried on a demo page.
- Exercised only against the fake GitHub in the test suite, not the real one: replies to parked issues and specs, and the monitor filing issues.
- Not yet exercised at all: the GitHub Actions workflow for target repositories, and non-Claude harnesses.

## Background

The design follows Zach Lloyd's "The guide to software factories". The memory loop follows the "knowledge factory" idea from LangChain.
