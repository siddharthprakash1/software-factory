The change does what the issue asks, and I found no real defects. I read the full `metrics.py` and `tests/test_metrics.py` and checked the new tests' pinned values by hand.

- **Empty input:** `_mean` and the three explicit `len` guards cover every public function that divides by the row count except `wilson`, which takes counts rather than rows. Its `n == 0` path already returns `(0.0, 1.0)` without a warning, and the issue doesn't cover it.
- **Non-empty numbers:** each `_mean` call computes the same `float(np.mean(...))` as before, and the remaining `.mean()` calls in `ece` and `risk_coverage_curve` sit behind `mask.any()`, `act.any()`, or a non-empty `probs`. So no reported number changes.
- **ECE pinned values:** I recomputed `test_ece_sums_over_several_nonempty_bins` by hand. Bins 10, 13 and 8 hold 4, 2 and 2 rows, with accuracies 0.75, 0.5 and 1.0, giving 0.025 + 0.1 + 0.1125 = 0.2375. The `p_max == 1.0` test does catch a dropped row: without the clamp, index 15 never matches the `range(n_bins)` loop and the total is 0, not 1.0.
- **Test split:** the old test's two assertions now live in two tests with the same data, and no assertion was removed, skipped or weakened.

Nothing in the diff goes beyond the issue.

```json
{"verdict": "approve", "summary": "Empty-input NaN handling is applied to every row-count metric in metrics.py, and non-empty results are unchanged. The new ECE tests pin correct values, and the combined autonomous/automation test is split into two single-purpose tests with no assertions lost.", "comments": [], "out_of_scope": []}
```