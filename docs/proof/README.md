# Proof of work: what the factory actually did

This folder is the evidence for the factory's runs on a real repository. Times in logs and file names are UTC.

Everything here can be checked against GitHub: each claim links to the issue, pull request or commit it describes.

**These are the second runs of the same two issues.** The factory first handled them on 23 November 2026. On 24 November the surety repository was recreated with rewritten commit history, which removed its issues and pull requests, so the same two issues were filed again and the factory ran on them again. The records and numbers below are from that rerun.

## Summary

| What | Result |
|---|---|
| Real repository used | [`siddharthprakash1/surety`](https://github.com/siddharthprakash1/surety) (Python, 183 tests) |
| Issues given to the factory | 2 ([#1](https://github.com/siddharthprakash1/surety/issues/1), [#2](https://github.com/siddharthprakash1/surety/issues/2)) |
| Pull requests it opened | 2 ([#3](https://github.com/siddharthprakash1/surety/pull/3), [#4](https://github.com/siddharthprakash1/surety/pull/4)), both open, not merged |
| Revisions made from a human PR comment | 1 (on #4), which also exposed a factory bug, described below |
| Lessons in memory | 5 ([`memory/surety.md`](../../memory/surety.md)) |
| Runs in total | 12 work runs (2 of them the superseded first runs), 6 eval runs, 1 monitor run, 1 retro |
| Usage, at API list prices | about $2.27 (see [Cost](#cost-and-who-pays)) |

## 1. Two issues became two pull requests

Both issues came from the "deferred minors" in surety's own handover ledger. They were filed on GitHub, labelled `factory`, and picked up by `factory poll`.

| Issue | PR | Commits | Change | Attempts | Cost |
|---|---|---|---|---|---|
| [#2 Metrics: NaN on empty input, ECE edge tests](https://github.com/siddharthprakash1/surety/issues/2) | [#3](https://github.com/siddharthprakash1/surety/pull/3) | `03dedb2`, `d651a5c` | +66 −8 in 2 files | 2 | $0.07 |
| [#1 Supervisor parser fixes](https://github.com/siddharthprakash1/surety/issues/1) | [#4](https://github.com/siddharthprakash1/surety/pull/4) | `d390599`, `9d3b7d2`, then 4 more from the revision | +37 −4 in 2 files | 2, then a revision | $0.18 |

On both issues the review agent approved the first attempt but listed changes the issue had not asked for, so the implement agent trimmed them and the second attempt was delivered. The full step-by-step log for each run is in [`data/event-logs.txt`](data/event-logs.txt):

```
20261124-070610-metrics-return-nan-without-a-runtime      status: ready_for_review   cost: $0.066   attempts: 2
  triage     haiku   automate/low               $0.011   33s
  implement  haiku   attempt 1 committed        $0.017  105s
  verify             passed                              20s     (uv run pytest -q)
  review     haiku   approve, with scope notes  $0.010   31s
  implement  haiku   attempt 2 committed        $0.012   70s
  verify             passed                              20s
  review     haiku   approve                    $0.011   37s
  deliver            pr opened
  learn      haiku   lessons updated            $0.005    8s
```

The factory reported back on each issue with the PR link. Each PR description is written by the factory and includes the test run from its verify stage (195 passed on #3).

## 2. A PR comment steered the factory, and showed a bug in it

A comment on PR #4 asked for one local variable to be renamed. The next `factory poll` picked it up and sent the run back to the implement stage, which made the rename.

Then the run got stuck. The review agent approved the change three times, and each time also listed something "beyond the issue" (an extra test, a new local variable). The factory treated every such note as a reason to send the change back, used up its three attempts, and stopped with "stuck, needs a person" on the issue. That was a defect in the factory, not in the change.

The fix, in this repository: scope notes now send a change back once. If the reviewer still has some after that, the change is delivered and the notes are shown to the human reviewer in the report. The review prompt also says not to list things the request needs. A second comment on the PR then let the run finish; it pushed the revision and replied on the PR.

The whole sequence is in the event log for run `20261124-071245-supervisor-parser-check-none-before-`, and on [PR #4](https://github.com/siddharthprakash1/surety/pull/4) and [issue #1](https://github.com/siddharthprakash1/surety/issues/1).

### Screenshots

The four github.com screenshots below were taken on 24 November 2026 **of the first runs**, before the repository was recreated. They show the same issues and the same flow, but their commit ids, dates and comment text differ from the live pages linked above. They will be replaced with screenshots of the rerun.

![Issue #2 on github.com with the factory's comment and the linked PR](images/surety-issue-2.jpg)

![PR #3 on github.com as opened by the factory](images/surety-pr-3.jpg)

![PR #4 on github.com](images/surety-pr-4.jpg)

![PR #4 conversation: the human comment and the factory's revision](images/surety-pr-4-comments.jpg)

![PR #4 commits](images/surety-pr-4-commits.png)

## 3. Memory

The learn stage writes rules for future runs on surety after each run that received feedback. They are in [`memory/surety.md`](../../memory/surety.md).

The rerun also showed how memory can go wrong. While the scope-check bug was sending good work back, the learn stage turned that feedback into two bad rules ("do not add tests the issue does not name", "do not introduce new locals"). Those were removed by hand. A lessons file needs review like any other change.

## 4. Browser verification

On the demo counter page, the issue "Add a Reset button" was implemented, and a verification agent then opened the running page in a real browser, clicked +1 three times, clicked Reset, and confirmed the count went back to 0. This is the screenshot that agent took:

![Counter page after the agent clicked Reset](images/browser-check-counter-reset.png)

Run record: [`data/runs/20261123-193238-add-a-reset-button-to-the-counter-pa/`](data/runs/20261123-193238-add-a-reset-button-to-the-counter-pa/).

## 5. Evals

Two demo issues were run against three configurations. Each has a hidden acceptance test the agents never saw. Raw results: [`data/eval-demo.json`](data/eval-demo.json).

| Variant | Cases | Delivered | Accepted | Total cost |
|---|---|---|---|---|
| default (cheap review for simple issues) | 2 | 2 | 2 | $0.046 |
| review-sonnet (mid-tier review always) | 2 | 2 | 2 | $0.228 |
| all-haiku | 2 | 2 | 2 | $0.044 |

## 6. Monitor

A test in a scratch copy of the demo repo was broken on purpose. The monitor ran the tests, saw the failure, found the faulty line, and wrote this issue: [`data/monitor-proposed-issue.md`](data/monitor-proposed-issue.md).

## 7. Dashboard

![Dashboard after these runs](images/dashboard.jpg)

## Cost and who pays

The dollar figures are what the same token usage would cost at Anthropic's API list prices. They are reported by the `claude` CLI after each agent call and added up by the factory.

| Bucket | Runs | List-price equivalent |
|---|---|---|
| Work runs (demo, demo-site, surety) | 12 | $1.724 |
| Eval runs | 6 | $0.317 |
| Monitor run, retro and one connectivity check | 3 | $0.226 |
| **Total** | | **$2.267** |

Nobody was billed that amount as a separate charge. On this machine the `claude` CLI is signed in with a claude.ai login on a **Claude Team plan**, and no API key is set. So the factory's agent calls were drawn from that Team seat's included usage, the same allowance used by Claude Code in normal use. If the seat's limit is reached, further runs stop or fall under whatever extra-usage setting that workspace has; that setting is not visible from here.

Running the factory in GitHub Actions would be different: there it uses an `ANTHROPIC_API_KEY`, and the owner of that key is billed per token at these prices.

## What this does not prove

- **The issue and PR screenshots are of the first runs**, as said above. The raw GitHub CLI records of the rerun are saved as [`data/surety-pr-3.json`](data/surety-pr-3.json), [`data/surety-pr-4.json`](data/surety-pr-4.json) and the issue files. The links are the final check.
- **The PRs are not merged.** Each run's tests passed in its worktree, but nobody with knowledge of surety has reviewed the diffs.
- **The rerun had an advantage:** the two lessons learned on the first runs were already in memory.
- **PR #4's description shows the numbers from when it was opened.** The factory pushes revisions and comments, but does not rewrite the description.
- **Not exercised on real GitHub:** the GitHub Actions workflow, the monitor's GitHub path, replies to parked issues or specs, and non-Claude harnesses.
- Run records under `data/runs/` contain local file paths from the machine that ran them.

## Files and checksums

```
images/   7 images referenced above
data/     raw GitHub records and diffs for the PRs and issues, run records, event logs,
          metrics, eval results, the monitor's proposed issue
MD5SUMS   MD5 checksum of every file in images/ and data/
```

To check that nothing in this folder was changed after it was committed:

```sh
cd docs/proof && md5sum -c MD5SUMS
```

The stronger guarantee is git itself: the history of this folder shows every edit, including the replacement of the first runs' records by the rerun's on 24 November 2026.
