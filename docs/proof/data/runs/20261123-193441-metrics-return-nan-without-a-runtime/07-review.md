The diff does what the issue asks. I could not run the test suite because the Bash call was denied, so this verdict rests on reading the code and hand-checking the pinned numbers.

- **Empty input:** every row-dividing metric now goes through `_mean`, which returns NaN for empty arrays without calling `.mean()`. `ece` returns NaN up front, and `risk_coverage_curve` returns NaN for `acted` and `error_rate_all`. The `act.any()` guard keeps `risk` at 0.0 with no warning.
- **Non-empty numbers:** `_mean` returns `float(a.mean())`, which matches the old `float(np.mean(...))` results. The `dtype=bool` change in `_top` is a no-op for non-empty input.
- **ECE pinned numbers:** I checked them by hand. Confidences 0.95, 0.75 and 0.55 land in bins 14, 11 and 8. Bin 14 gives 0.5 × |0.5 − 0.95| = 0.225, bin 11 gives 0.0625, and bin 8 gives 0.1375, for a total of 0.425. The `p_max == 1.0` case clamps to bin 14 and yields 1.0 when wrong and 0.0 when right.
- **Test split:** `automation_rate` and `autonomous_error_rate` now have separate tests, as the issue asks.

Nothing unrelated is touched.

```json
{"verdict": "approve", "summary": "The change returns NaN without a RuntimeWarning for empty input across the row-dividing metrics, leaves non-empty results unchanged, and adds ECE edge-case tests whose pinned values I verified by hand. I could not run pytest because the Bash call was denied, so the test results are unverified.", "comments": []}
```