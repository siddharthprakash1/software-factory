# Metrics: return NaN without a RuntimeWarning on empty input and cover ECE edge cases

- Run: 20261124-070610-metrics-return-nan-without-a-runtime
- Branch: `factory/20261124-070610-metrics-return-nan-without-a-runtime` in C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety
- PR: https://github.com/siddharthprakash1/surety/pull/3
- Attempts: 2, cost: $0.061
- Triage: automate / low - The change is a few NaN guards in one module plus test additions and a test split, and no non-empty number changes. The only judgment call is making ECE return NaN on empty input, which the issue's wording does not directly cover.
- Review: Empty-input NaN handling is applied to every row-count metric in metrics.py, and non-empty results are unchanged. The new ECE tests pin correct values, and the combined autonomous/automation test is split into two single-purpose tests with no assertions lost.

## Changes
```
src/surety/calib/metrics.py | 25 ++++++++++++++++-------
 tests/test_metrics.py       | 49 ++++++++++++++++++++++++++++++++++++++++++++-
 2 files changed, 66 insertions(+), 8 deletions(-)
```

## Verification
```
$ uv run pytest -q
........................................................................ [ 36%]
........................................................................ [ 73%]
...................................................                      [100%]
195 passed, 1 skipped in 17.79s


```

<details><summary>Run log: every step the factory took</summary>

| Step | Model | Outcome | Cost | Seconds |
|---|---|---|---|---|
| triage | haiku | automate/low | $0.011 | 33 |
| implement | haiku | attempt 1 committed | $0.017 | 105 |
| verify |  | passed |  | 20 |
| review | haiku | approve | $0.010 | 31 |
| implement | haiku | attempt 2 committed | $0.012 | 70 |
| verify |  | passed |  | 20 |
| review | haiku | approve | $0.011 | 37 |

</details>

Inspect: `git -C "C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety" diff 792d60d7..factory/20261124-070610-metrics-return-nan-without-a-runtime`
