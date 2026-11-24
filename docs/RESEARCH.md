# What real software factories do, and what this one should copy

Research notes from 24 November 2026. The question: this factory follows one article, so what are the teams actually running factories doing that it lacks?

How to read this: the sources were read by a research agent and summarised; the rankings and the "status here" column are judgment, not findings. Three sources could not be read and are marked.

## The short version

1. The teams with the most experience spend their effort on **verification and limits**, not on smarter agents. Deterministic steps, hard retry caps, tests the agent cannot touch, and a judge that asks "is this what was asked for?"
2. **Security is the first thing to get right once a repo is public.** An agent that reads public issues, holds a token and can run commands is the textbook prompt-injection target.
3. **Memory needs a lifecycle.** A lessons file that only grows becomes noise. Lessons should be promoted, retired, and ideally turned into mechanical checks.
4. A lot of what gets attention (agent swarms, "no human reads the code", digital twins) is not worth it at this scale.

## Techniques, ranked for a small team

| # | Technique | Who does it | Status here |
|---|---|---|---|
| 1 | **Only people with write access can trigger or steer; hidden text is stripped** | [GitHub Copilot agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations), [claude-code-action](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md), [Willison's "lethal trifecta"](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) | **Built.** Comments from non-collaborators are ignored; HTML comments and invisible characters are removed from issue and comment text. |
| 2 | **A judge that compares the diff with the task** and vetoes work that goes beyond it | [Spotify](https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3) (vetoes about a quarter of sessions), [Warp](https://www.warp.dev/blog/software-factory-build-guide) | **Built**, inside the review stage: it lists out-of-scope changes, which send the run back once; whatever remains after that goes to the human reviewer in the report. (Sending back every time made an approved change use up all its attempts on a real run.) A separate judge call would be closer to Spotify's design. |
| 3 | **Deterministic steps and a hard retry cap** | [Stripe "Minions"](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2): only implement and fix-CI are agents; two CI rounds, then a human | **Had it.** Verify, guard and deliver are plain code; 3 attempts and a budget, then a person. |
| 4 | **Tests the agent cannot game** | [StrongDM](https://factory.strongdm.ai/) keeps scenarios outside the repo; [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) forbids editing tests | **Partly built.** A guard now blocks changes to CI config and protected paths, and deleted test files. Hidden acceptance tests exist only in evals, not on real runs. |
| 5 | **Proof of work attached to the PR** | [Warp](https://www.warp.dev/blog/software-factory-build-guide), [Ramp](https://engineering.ramp.com/post/why-we-built-our-background-agent) (before/after screenshots), [OpenAI](https://openai.com/index/harness-engineering/) (video of bug and fix) | **Partly built.** PRs carry the test output and now the full run log. Screenshots from the browser check are saved locally but not attached. |
| 6 | **Memory with a lifecycle**: candidate rules get promoted on repeated signal and retired on negative signal | [Cursor Bugbot](https://cursor.com/blog/bugbot-learning) | **Not built.** The learn stage rewrites a capped list each time, which is a weak form of curation. |
| 7 | **Lessons become linters**, and the agent's instruction file stays a short map | [OpenAI harness engineering](https://openai.com/index/harness-engineering/) | Not built. |
| 8 | **Scheduled cleanup agents** that open small refactor PRs | OpenAI, same post | Not built. The monitor only reacts to failures. |
| 9 | **Mining the factory's own runs for friction** and filing tickets against the factory | [Factory "Signals"](https://factory.com/news/factory-signals) | **Built, in a small form.** `factory retro` counts what sent work back and has an agent propose changes with evidence. It does not file tickets or cluster across many sessions. |
| 10 | **Replaying real past work** from its exact starting state to compare configurations | [Warp, "the factory stack"](https://www.warp.dev/blog/the-factory-stack) | **Built.** `factory replay <run-id> --variant <name>`. |
| 11 | **A real sandbox**: filesystem and network isolation, credentials held outside | [Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing) | **Not built, and the biggest remaining gap.** A git worktree is not isolation. Docker is not installed on this machine. |
| 12 | **A calibrated, separate evaluator** with examples and thresholds, because agents praise their own work | [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Partly: review is a separate agent, but uncalibrated. |
| 13 | **Triage that reproduces the bug** before routing | Warp build guide | Not built. Triage reads code but does not run anything. |
| 14 | Pre-warmed environments | Ramp, Stripe | Not needed at this scale. |
| 15 | Planner and worker hierarchies | [Cursor](https://cursor.com/blog/scaling-agents) | Not needed for issue-sized work. |

One more finding that applies directly: `claude -p` runs a target repository's own `.claude` hooks and MCP servers without a trust prompt ([docs](https://code.claude.com/docs/en/headless)). Only point the factory at repositories whose contents you trust.

## Other kinds of factory

- **Knowledge factory** (Harrison Chase; the original is behind a login, this is from a [secondary summary](https://darkfactory.dev/news/2026-11-21-midday/story-3)). Working agents only *flag* missing or wrong knowledge. A separate curator agent rewrites the knowledge store on a schedule, because agents that maintain their own notes produce contradictions. Outputs are skills and domain notes. This is the model the memory lifecycle above should follow.
- **Research factory** ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)). A lead agent plans, parallel search agents return condensed findings, a citation agent attributes claims. It costs roughly 15 times a normal chat.
- **Migration factory.** One repetitive change applied file by file with retries; Airbnb moved about 3,500 test files this way ([InfoQ](https://www.infoq.com/news/2025/03/airbnb-llm-test-migration/), snippet only).
- **Product-signal factory.** The loop starts from user feedback and logs and ends in prioritised issues, not only code ([Latent Space](https://latent.space/p/aiewf-daily-dispatch-loops)).

## Not worth copying

- **"No human reads the code"** and very high spend per engineer: StrongDM's own benchmark; [Willison](https://simonwillison.net/2026/Feb/7/software-factory/) doubts skipping review.
- **Digital twins of third-party services**: only pays off with heavy integrations. Recorded fixtures are enough.
- **Large agent swarms**: coordination overhead dominates, and coding parallelises poorly.
- **"Ralph" loops on existing repos**: [its author](https://ghuntley.com/ralph/) recommends it for greenfield work only.
- **Mutation testing as a gate**: slow, and no factory was found using it in production.
- **Classifiers that detect prompt injection**: a 95% catch rate is a failing grade. Remove capabilities instead.

## Could not verify

- Harrison Chase's "How to build a knowledge factory" (X article, login wall).
- Steve Yegge's "Welcome to Gas Town" (blocked); claims about it come from search snippets.
- The talk titles from the AI Engineer World's Fair software-factories track.

## What to build next, in order

1. **A sandbox for agent runs.** Run each agent in a container with no network except the model API, and keep the GitHub token outside it. This matters most before the factory handles issues written by strangers.
2. **Memory lifecycle.** Store lessons with a status and hit count; promote on repetition, retire when a person rejects work that followed one; have a curator propose changes as a pull request to `memory/`.
3. **Proof bundle.** Attach browser-check screenshots and the review verdict to the PR as a comment.
4. **Hidden acceptance checks on real runs.** Let a repository keep scenario tests outside the worktree that run only after review.
5. **Triage that reproduces.** Give triage a read-only way to run the failing case before it routes.
