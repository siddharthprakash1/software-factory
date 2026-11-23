# formatDuration returns an empty string for 0 and breaks on days

Two problems in `src/duration.mjs`:

1. `formatDuration(0)` returns `""`. It should return `"0s"`.
2. Durations of a day or more are shown only in hours, e.g. `formatDuration(90061)` returns `"25h 1m 1s"`. It should use days: `"1d 1h 1m 1s"`.

Negative or non-integer input should throw a `RangeError`.
