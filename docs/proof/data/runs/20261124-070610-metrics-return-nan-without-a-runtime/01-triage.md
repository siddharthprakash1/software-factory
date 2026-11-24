The issue is clear and the fix is small. Everything below is from reading `src/surety/calib/metrics.py` and `tests/test_metrics.py`. I did not change any files.

**Current behaviour**
- Empty input emits a RuntimeWarning and returns NaN in `accuracy`, `brier`, `confident_error_rate`, `coverage`, `mean_set_size`, `automation_rate`, and `autonomous_error_rate`. Each does a direct NumPy `.mean()` or `np.mean()`.
- `risk_coverage_curve` on empty input gives `acted` NaN and `error_rate_all` NaN with a warning. `risk` is 0.0 because of its `act.any()` guard.
- `ece` on empty input returns 0.0 silently. It never divides by N directly, so it is not caught by the issue's wording, but 0.0 reads as "perfectly calibrated". I would make it NaN too.
- `wilson` already returns early on `n == 0`, so it is out of scope.

**Gaps in the lessons above**
- The `_mean` helper and the `EMPTY_METRIC_CALLS` table do not exist in these files. The implementer has to create them.
- `risk_coverage_curve` has a non-empty convention that must stay: `risk` is 0.0 when nothing is acted on, and `test_risk_coverage_monotone_acted` pins it (`rc[3]`). The empty-input NaN therefore needs a `len(probs) == 0` guard, not a change to the `act.any()` branch.

**Callers**
- `src/surety/eval/analyze.py` calls these metrics at lines 79–181. Line 133 slices `sets[-TAIL:]`, which can be empty. Line 181 filters with `c["acted"] > 0`, and that comparison is False for NaN, so the filter still drops those rows. The implementer should check how the NaN values render in the report tables.

**Plan**
1. `metrics.py`: add a `_mean(x)` helper that returns NaN when `len(x) == 0`, and route the row-count means through it. Add a `len == 0` guard in `ece` and in `risk_coverage_curve` (for `acted`, `risk`, and `error_rate_all`). Non-empty paths stay byte-identical.
2. `tests/test_metrics.py`: add an `EMPTY_METRIC_CALLS` table covering every public metric that takes row-based input. Each case asserts no RuntimeWarning under `warnings.catch_warnings(record=True)` with `simplefilter("always")`, and that the result is NaN. For `risk_coverage_curve`, assert the per-threshold fields.
3. ECE tests with pinned numbers:
   - `p_max == 1.0` lands in the last bin. For example, `[{"a":1.0,"b":0.0}]` with gold `"b"` gives 1.0, and gold `"a"` gives 0.0.
   - Multi-bin sum. For example, `[{"a":0.9,"b":0.1}]` with gold `"a"` (bin 13, error 0.1) and `[{"a":0.6,"b":0.4}]` with gold `"b"` (bin 9, error 0.6) give `0.5*0.1 + 0.5*0.6 = 0.35`. The implementer should verify these by hand before pinning them.
4. Split `test_autonomous_error_counts_only_singletons` into `test_automation_rate_counts_only_singletons` and `test_autonomous_error_rate_counts_only_singletons`, each asserting one function.

Argmax tie-breaking (also listed in the progress note) is not part of this issue and should stay out of scope.

```json
{"decision": "automate", "complexity": "low", "reason": "The change is a few NaN guards in one module plus test additions and a test split, and no non-empty number changes. The only judgment call is making ECE return NaN on empty input, which the issue's wording does not directly cover.", "plan": "src/surety/calib/metrics.py: add a _mean helper that returns NaN for empty input and use it in accuracy, brier, confident_error_rate, coverage, mean_set_size, automation_rate, autonomous_error_rate; add len==0 guards in ece (return NaN) and risk_coverage_curve (NaN for acted, risk, error_rate_all on empty input only, keeping risk=0.0 when nothing is acted on for non-empty input). tests/test_metrics.py: add an EMPTY_METRIC_CALLS parametrized table asserting no RuntimeWarning and NaN results; add pinned ECE tests for the p_max==1.0 clamp and a multi-bin sum (verify the hand-computed values); split test_autonomous_error_counts_only_singletons into automation_rate and autonomous_error_rate tests. Note that _mean and EMPTY_METRIC_CALLS do not exist yet and must be created. Check src/surety/eval/analyze.py (lines ~79-181) for how NaN from empty slices (e.g. sets[-TAIL:]) renders in reports. Argmax tie-breaking is out of scope."}
```