The metrics change is in place and the full suite passes (195 passed, 1 skipped), but the diff is only partly what the feedback asked for. The `dtype=` removal needed one extra guard to keep empty input working.

**What changed in this pass**
- **`src/surety/calib/metrics.py`**
  - Reverted the explicit `dtype=float` and `dtype=bool` arguments in `_top`, as the feedback asked.
  - Removing `dtype=bool` broke `confident_error_rate` on empty input, because `conf >= threshold` and the empty `wrong` array could not be combined with `&`. I added a `len(probs) == 0` guard that returns NaN, the same pattern `ece` already uses. Non-empty results are unchanged.

**Already in the prior commit and left as-is**
- `_mean` helper, used by `accuracy`, `brier`, `coverage`, `mean_set_size`, `automation_rate`, and `autonomous_error_rate`.
- `len == 0` guards in `ece` and `risk_coverage_curve`.
- `EMPTY_METRIC_CALLS` table covering every row-count metric, asserting no `RuntimeWarning` and NaN results.
- ECE tests for the `p_max == 1.0` clamp and a multi-bin sum. I hand-checked the pinned 0.2375 for the multi-bin case: bins 10, 13 and 8 contribute 0.025, 0.1 and 0.1125.
- `test_automation_rate_counts_only_singletons` and `test_autonomous_error_counts_only_singletons` are already separate, each asserting one metric.

**Report rendering:** `analyze.py` formats floats with `:.3f`, so NaN prints as `nan` in tables. The `sets[-TAIL:]` slice is only empty when there are no sets at all, and that case is already NaN. I did not change `analyze.py`.

Nothing is committed; the factory will commit.