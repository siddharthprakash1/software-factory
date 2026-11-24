The change does what the issue asks, and I found no real defects. I did not run the test suite; the factory's `uv run pytest -q` run is the evidence for that.

**Checks against the issue**

1. **NaN without warning.** Every public function that divides by the row count now goes through `_mean` or has an explicit `len == 0` guard. `ece` needs its own guard, because without one it would return `0.0` rather than NaN. `risk_coverage_curve` returns NaN for all three keys, and its empty-input dict has the same keys as the non-empty branch. `wilson` is the only public function not covered. It already returns `(0.0, 1.0)` for `n == 0` without warning. That is an existing interval contract rather than a row-count mean, so I left it alone.
2. **ECE edge cases.** `test_ece_confidence_one_lands_in_last_bin` is meaningful: `1.0 * 15 = 15` is clamped to bin 14, and without the clamp the row would fall outside `range(n_bins)` and the result would be 0.0 instead of 1.0. `test_ece_sums_over_several_nonempty_bins` checks out by hand. Bins are 10 (0.7), 13 (0.9) and 8 (0.55), with weights 0.5, 0.25, 0.25 and per-bin gaps 0.05, 0.40, 0.45. That gives 0.025 + 0.100 + 0.1125 = 0.2375, which is what the test pins.
3. **Split test.** The automation-rate assertion moved into its own test, and the autonomous-error assertion stayed in the other. No assertion was dropped or weakened.

**Non-empty numbers.** The `_top` dtype change does not alter values. `conf` was already float64 for float inputs, and `wrong` was already bool. Every other metric returns the same value as before for non-empty input.

**Test table.** `EMPTY_METRIC_CALLS` covers all the row-count metrics. Its assertions match the issue: no `RuntimeWarning`, and all returned values are NaN.

**Out of scope.** The `dtype=float` / `dtype=bool` arguments in `_top` are not needed by the new guards. They are harmless and make empty arrays well-typed, but they were not requested.

```json
{"verdict": "approve", "summary": "Empty-input metrics now return NaN with no RuntimeWarning via _mean and explicit guards, and the ECE edge-case tests pin correct numbers (the 0.2375 multi-bin sum checks out by hand). The automation-rate assertion is split into its own test without dropping or weakening any assertion, and non-empty outputs are unchanged.", "comments": [], "out_of_scope": ["Explicit dtype=float / dtype=bool arguments in _top: not needed by the new guards; harmless hardening that was not requested."]}
```