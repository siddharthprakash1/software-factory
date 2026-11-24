I made the four supervisor parser fixes and reworked the tests to match the feedback. `uv run pytest -q` passes: 194 passed, 1 skipped.

**Changes in `src/surety/supervise/client.py`**
- **NONE first:** `choose` now checks `_is_none(text)` before `_parse`. When the text contains NONE, the result is `None` and `abstained` is `True`, so `NONE, not a1` no longer resolves to `a1`.
- **Unknown ids rejected:** the allowed list is `state.options` ids, or the candidate ids filtered to those ids. An id outside `state.options` is treated as unparsed. I removed the redundant filter on the default path, as the feedback asked.
- **Hyphen prefix:** the id lookbehind is now `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead still rejects `E1x` and `E1-`, and `_is_none` is unchanged, so abstention markers don't start matching more widely.

**Changes in `tests/test_supervisor.py`**
- `test_parse_cases` is now the single parametrized parse test. It covers `E12` vs `E1`, trailing punctuation, `-E1`, `NONE, not a1`, an unknown id, a lowercase candidate outside `state.options`, and a 500 response that expects `httpx.HTTPStatusError`. I removed the `a1 or NONE` case and the separate `test_http_error_raises`, which the parametrized test now covers.
- `test_reasoning_fallback_none_is_abstention` is the one new test function. It checks that a NONE in the reasoning fallback abstains.

The new cases fail on the old code: `NONE, not a1` returned `a1`, `-E1` returned nothing, the unknown id was accepted, and the reasoning NONE returned `b2`.

**Decision for you to confirm:** the HTTP 5xx case still expects `httpx.HTTPStatusError` to be raised, as the existing test did. If you want a 5xx to return `None` instead, that is a one-line change to the test and the client.

I did not commit or push.