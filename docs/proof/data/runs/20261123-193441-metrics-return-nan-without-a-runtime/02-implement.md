The metrics change is in place and `uv run pytest -q` passes: 194 passed, 1 skipped (the skip was already there before my change).

**What changed**

- **`src/surety/calib/metrics.py`**
  - Added a small `_mean` helper that returns NaN for an empty input without calling NumPy's mean. `accuracy`, `brier`, `confident_error_rate`, `coverage`, `mean_set_size`, `automation_rate` and `autonomous_error_rate` now use it. Non-empty arithmetic is unchanged.
  - `_top` now builds the `wrong` array with `dtype=bool`. Before, an empty input produced a float array, and `~` and `&` on it raised `TypeError`.
  - `ece` returns NaN on empty input.
- **`tests/test_metrics.py`**
  - Split `test_autonomous_error_counts_only_singletons` into `test_automation_rate_counts_singleton_sets` and `test_autonomous_error_counts_only_singletons`.
  - Added `test_ece_p_max_of_one_lands_in_last_bin`. Pins `ece` to 1.0 for a wrong prediction at p_max = 1.0 and 0.0 for a right one.
  - Added `test_ece_sums_over_several_non_empty_bins`. Four items across three bins give a pinned 0.425, hand-computed in the comments.
  - Added a parametrized empty-input test over all eight metrics. It asserts NaN with `RuntimeWarning` escalated to an error.

**Decisions for the PR**

- **ECE on empty input is now NaN, not 0.0.** The triage assumed 0.0 with no warning, but on the original code it actually raised `TypeError`. I chose NaN so an empty set can't read as perfectly calibrated, and it matches the other metrics. This is the one behaviour change for empty input beyond the warning removal, so reviewers should confirm it.
- `wilson` and `risk_coverage_curve` already handle empty input without a warning, so I left them alone.

I did not commit, push or switch branches.