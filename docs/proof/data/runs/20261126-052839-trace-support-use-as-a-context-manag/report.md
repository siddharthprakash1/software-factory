# Trace: support use as a context manager

- Run: 20261126-052839-trace-support-use-as-a-context-manag
- Branch: `factory/20261126-052839-trace-support-use-as-a-context-manag` in C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety
- PR: https://github.com/siddharthprakash1/surety/pull/6
- Attempts: 1, cost: $0.007
- Triage: automate / low - Trace is a 17-line class that opens its file in __init__ and closes it in close(), so adding __enter__ and __exit__ is a single obvious edit. The issue names the only two files to touch, and the test file shows the existing style to follow.
- Review: Adds __enter__ and __exit__ to Trace so it can be used in a with block, closing the file on exit including when the block raises. Two tests cover the normal path (row written, file closed) and the exception path (file closed, exception propagated, row written).
- Risk: **low** (small, first attempt, tests fail without the change, nothing flagged)

## Changes
```
src/surety/trace/jsonl.py |  6 ++++++
 tests/test_trace.py       | 23 +++++++++++++++++++++++
 2 files changed, 29 insertions(+)
```

## Verification
```
$ uv run pytest -q   (in sandbox)
........................................................................ [ 38%]
........................................................................ [ 77%]
.........................................                                [100%]
185 passed, 1 skipped in 16.96s
Downloading cpython-3.12.16-linux-x86_64-gnu (download) (33.1MiB)
 Downloaded cpython-3.12.16-linux-x86_64-gnu (download)
Using CPython 3.12.16
Creating virtual environment at: /home/node/venv
Installed 25 packages in 8.69s


```

<details><summary>Run log: every step the factory took</summary>

| Step | Model | Outcome | Cost | Seconds |
|---|---|---|---|---|
| triage | haiku | automate/low | $0.002 | 10 |
| implement | haiku | attempt 1 committed | $0.002 | 58 |
| verify |  | passed |  | 41 |
| fail_to_pass |  | new tests fail on the original code |  | 28 |
| review | haiku | approve | $0.002 | 10 |

</details>

Inspect: `git -C "C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety" diff 792d60d7..factory/20261126-052839-trace-support-use-as-a-context-manag`
