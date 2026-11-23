I addressed the reviewer's feedback and the rest of the issue. The full suite passes (195 passed, 1 skipped), and the supervisor, h3 and runner tests pass (55 passed).

**Changes**

- **`src/surety/supervise/client.py`**: I reverted the `_is_none` lookbehind to `(?<![\w-])`, so `-NONE` no longer counts as an abstention. `_parse` keeps `(?<!\w)`, which is what lets `-E1` parse as `E1`. The NONE-before-ids ordering and the `state.options` filter from the previous attempt stay as they were.
- **`tests/test_supervisor.py`**: I added the case `("E1 -NONE", "E1", False)` to the existing parametrized `test_choose_parse_cases`. It expects `E1` and no abstention. Under the previous `(?<!\w)` version of `_is_none`, this case would have been an abstention and failed.

**Already covered by the existing tests**

- `E1` vs `E12`, trailing punctuation, `NONE, not a1`, and `-E1` are in the parametrized table.
- Out-of-options ids are dropped.
- The HTTP error path has a test asserting `httpx.HTTPStatusError` propagates. I left that behaviour unchanged, since the issue asked to keep existing behaviour.

I did not commit or push.