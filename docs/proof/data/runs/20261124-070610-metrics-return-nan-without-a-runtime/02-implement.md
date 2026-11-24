All three parts of the issue are done, and `uv run pytest -q` passes: 195 passed, 1 skipped (baseline was 183 passed, 1 skipped; the 12 new cases account for the difference).

**`src/surety/calib/metrics.py`**
- Added a `_mean` helper that returns NaN for empty input. `accuracy`, `brier`, `confident_error_rate`, `coverage`, `mean_set_size`, `automation_rate` and `autonomous_error_rate` now use it.
- `ece` returns NaN when given no rows.
- `risk_coverage_curve` returns NaN for `acted`, `risk` and `error_rate_all` on empty input. For non-empty input, `risk` stays `0.0` when nothing is acted on.
- `_top` now builds `conf` as float and `wrong` as bool. Without this, an empty `wrong` array is float, and `~` and `&` on it raise a TypeError. For non-empty input the values are unchanged.

**`tests/test_metrics.py`**
- `EMPTY_METRIC_CALLS` is a parametrized table covering every NaN-returning public metric. Each case asserts no `RuntimeWarning` is recorded and that all returned values are NaN. `wilson` is left out because it already returns `(0.0, 1.0)` for `n=0` without a warning.
- `test_ece_confidence_one_lands_in_last_bin`: one row with p_max = 1.0 and the wrong label gives ECE = 1.0. Without the clamp the row would fall outside the bin loop and be dropped, giving 0.
- `test_ece_sums_over_several_nonempty_bins`: eight rows across three bins (conf 0.7, 0.9, 0.55) give 0.5·0.05 + 0.25·0.40 + 0.25·0.45 = 0.2375. I hand-computed this and it matches the code.
- Split `test_autonomous_error_counts_only_singletons` into `test_automation_rate_counts_only_singletons` and the original test, which now checks only `autonomous_error_rate`.

**Not verified:** I did not run the new tests against the old code to confirm they fail there. The empty-input cases should fail on the old code because `np.mean([])` emits the warning, but that is from reading the code, not from a run. The two ECE tests pin existing behaviour, so they pass before and after.

**Reports:** `analyze.py` already formats NaN as `nan` through `_fmt`, and the empty-tail `sets[-TAIL:]` case in `_aci_row` will now produce that quietly. I made no change there, and non-empty reported numbers are unchanged.