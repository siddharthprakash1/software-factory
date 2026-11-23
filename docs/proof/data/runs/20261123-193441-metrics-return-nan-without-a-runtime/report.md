# Metrics: return NaN without a RuntimeWarning on empty input and cover ECE edge cases

- Run: 20261123-193441-metrics-return-nan-without-a-runtime
- Branch: `factory/20261123-193441-metrics-return-nan-without-a-runtime` in C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety
- PR: https://github.com/siddharthprakash1/surety/pull/3
- Attempts: 2, cost: $0.055
- Triage: automate / low - Two files, one obvious pattern: guard the row-averaging metrics for empty input so they return NaN without a warning, and add pinned ECE tests and a split test. Non-empty outputs are unchanged, so the change is verifiable by the existing and new tests.
- Review: The change returns NaN without a RuntimeWarning for empty input across the row-dividing metrics, leaves non-empty results unchanged, and adds ECE edge-case tests whose pinned values I verified by hand. I could not run pytest because the Bash call was denied, so the test results are unverified.

## Changes
```
src/surety/calib/metrics.py | 27 +++++++++++++--------
 tests/test_metrics.py       | 58 ++++++++++++++++++++++++++++++++++++++++++++-
 2 files changed, 74 insertions(+), 11 deletions(-)
```

## Verification
```
$ uv run pytest -q
........................................................................ [ 36%]
........................................................................ [ 73%]
...................................................                      [100%]
195 passed, 1 skipped in 22.88s


```

Inspect: `git -C "C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety" diff 006f1805..factory/20261123-193441-metrics-return-nan-without-a-runtime`
