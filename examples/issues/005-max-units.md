# Add a maxUnits option to formatDuration

`formatDuration(seconds, { maxUnits: n })` should keep only the `n` largest non-zero units, dropping the rest without rounding. Example: `formatDuration(3909, { maxUnits: 2 })` returns `"1h 5m"`. Without the option the output is unchanged. `maxUnits` must be a positive integer, otherwise throw a `RangeError`.
