The counter page now has a Reset button between -1 and +1 that sets the count back to 0. `npm test` passes (2 of 2).

- **`src/counter.mjs`**: added `reset()`, which sets `value` to the literal `0`, not `start`, as the issue asks.
- **`test/counter.test.mjs`**: added a test that increments three times, calls `reset()`, and asserts the value is 0. Before this change, `reset` doesn't exist, so the test would throw a TypeError and fail.
- **`index.html`**: added `<button id="reset">Reset</button>` between the -1 and +1 buttons. Its `onclick` calls `counter.reset()` and then `render()`, the same pattern as the existing handlers.

Nothing was committed, pushed, or switched. The working tree shows the three modified files.