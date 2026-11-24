The supervisor parser fixes were already on this branch. I removed the one test the feedback flagged, and the full suite passes (`uv run pytest -q`: 194 passed, 1 skipped).

**What's in the change (`src/surety/supervise/client.py`)**
1. **NONE wins:** `choose` checks `_is_none(text)` first. If it matches, the answer is abstained and no candidate is parsed, so `NONE, not a1` returns `None`.
2. **Unknown ids are rejected:** `allowed` is filtered to ids that exist in `state.options`, so a candidate like `z9` that is not an option is treated as unparsed.
3. **Hyphen-prefixed ids parse:** the id lookbehind in `_parse` changed from `(?<![\w-])` to `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead and `_is_none` are unchanged.

**Tests (`tests/test_supervisor.py`)**
- `test_parse_cases` is parametrized over `E12`, `E1`, `E1.`, `answer: E1, done`, `-E1`, `NONE, not a1`, `a1 or NONE`, `Z9`, `E1x`, and a candidate list containing an id outside the options. Before this change, `NONE, not a1`, `-E1`, and the unknown-candidate case all fail.
- `test_http_error_raises` covers the HTTP error path. It is a separate test function because the parametrized test asserts return values, not exceptions. The issue asks for the error path to be covered, so I kept it, but say if you want it folded into the parametrized test.

**Removed:** `test_reasoning_fallback_none_is_abstention`, per the feedback.

I did not run the new tests against the pre-change code, so the "would have failed before" claim is from reading the old regex and control flow, not from a run.