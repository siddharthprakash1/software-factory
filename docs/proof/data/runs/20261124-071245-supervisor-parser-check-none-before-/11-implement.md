All four parts of the issue are in place, the reviewer's rename is done, and `uv run pytest -q` passes (195 passed, 1 skipped).

**What changed**

- **`src/surety/supervise/client.py`**
  - `choose` checks `_is_none(text)` before parsing, so `NONE, not a1` abstains instead of returning `a1`.
  - `choose` keeps only candidate ids that are in `state.options`, so an id outside the options is treated as unparsed.
  - The local variable `none` is renamed to `abstained`, as the reviewer asked. Behaviour is unchanged.
  - `_parse` uses the lookbehind `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead `(?![\w-])` is unchanged.
- **`tests/test_supervisor.py`**
  - A parametrized `test_parse_cases` covers `E12` and `E1`, trailing punctuation, `NONE, not a1`, `-E1`, an unknown id, and a candidate outside the options.
  - `test_reasoning_fallback_none_is_abstention` covers the case from the triage plan where the reasoning fallback contains `NONE`. The issue did not name this case, so drop it if you want the test set kept to the issue's list.
  - `test_http_error_raises` asserts that an HTTP 500 raises `httpx.HTTPStatusError`.

**Open point:** the triage plan asks for the HTTP error expectation to be confirmed before merging. I kept the raise. A human would need to say whether they want `None` instead. I could not confirm that here.

I did not commit anything.