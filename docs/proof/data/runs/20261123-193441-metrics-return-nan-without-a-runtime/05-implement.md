The feedback gap is closed: `risk_coverage_curve` no longer emits a RuntimeWarning on empty input. The full suite passes (195 passed, 1 skipped).

**What changed**

- **`src/surety/calib/metrics.py`**: in `risk_coverage_curve`, `acted` and `error_rate_all` now go through the existing `_mean` helper instead of calling `.mean()` directly. On empty input they return NaN with no warning. For non-empty input the values are the same floats as before.
- **`tests/test_metrics.py`**: added `test_risk_coverage_empty_input_returns_nan_without_runtime_warning`. It runs with RuntimeWarning treated as an error and asserts NaN for `acted` and `error_rate_all`. I ran it before the fix and it failed with "Mean of empty slice", then it passed after the fix.

**Already in place from the previous attempt (checked, not changed)**

- The scalar metrics and `ece` already return NaN on empty input, covered by the parametrized empty-input test.
- The ECE tests exist with pinned values: `p_max == 1.0` lands in the last bin (1.0), and the multi-bin sum is 0.425. I re-derived the 0.425 by hand and it matches.
- `test_autonomous_error_counts_only_singletons` no longer asserts `automation_rate`. `automation_rate` has its own test.

**Choices to review**

- `risk` stays `0.0` when nothing is acted on, including the empty-input case. That matches the existing non-empty convention. It is a divide by the acted count, not by rows, so I left it alone. Say if you want NaN there too.
- `ece` returns NaN on empty input, the same as the other metrics, so no separate decision is needed there.

Nothing was committed or pushed.