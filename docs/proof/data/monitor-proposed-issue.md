# Fix minutes calculation in formatDuration (divides by 30 instead of 60)

## What fails
`npm test` exits 1. The test `formats hours, minutes and seconds` in `test/duration.test.mjs:5` fails. The test `omits zero units` passes.

## Evidence
`formatDuration(3909)` should return `'1h 5m 9s'`. It returns `'1h 10m 9s'`. The test output shows `+ '1h 10m 9s'` and `- '1h 5m 9s'`. The minutes value is exactly double what it should be.

## Likely cause
`src/duration.mjs:4` computes minutes as `Math.floor((totalSeconds % 3600) / 30)`. A minute has 60 seconds, so the divisor should be `60`. For 3909 s, `(3909 % 3600) / 30` is 309/30, which gives 10. The correct result is 309/60, which gives 5. The `omits zero units` test passes only because `3600 % 3600` is 0, so the bug does not show.

## Done looks like
- `src/duration.mjs:4` divides by 60.
- `formatDuration(3909)` returns `'1h 5m 9s'`.
- `npm test` passes with both tests green.

_Filed by the software factory's monitor._
