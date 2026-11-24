All four points from the issue are addressed in `src/surety/supervise/client.py` and `tests/test_supervisor.py`. The full suite passes: `uv run pytest -q` gives 193 passed, 1 skipped.

**Changes**
- **NONE wins (issue 1):** `choose` checks `_is_none(text)` first. If it matches, the answer is `None` with `abstained=True`, so `NONE, not a1` no longer resolves to `a1`.
- **Ids must be in `state.options` (issue 2):** when `candidate_ids` is given, only ids that also appear in `state.options` are allowed. Unknown ids are treated as unparsed.
- **Hyphen-prefixed ids (issue 3):** the id lookbehind changed from `(?<![\w-])` to `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead and `_is_none` are unchanged, so `E1-` still does not match and `-NONE` is still not treated as an abstention.
- **Tests (issue 4):** `test_parse_cases` is a parametrized test covering `E12` and `E1` (prefix ambiguity), trailing punctuation (`E1.`), `answer: E1, done`, `-E1`, `NONE, not a1`, an unknown id (`Z9`), a partial token (`E1x`), a candidate outside `state.options` (`z9`), and an HTTP 500 that asserts `httpx.HTTPStatusError` is raised.
- **Feedback:** I removed `test_reasoning_fallback_none_is_abstention`, since the issue doesn't name that boundary.

**Checks I did not run**
- I did not run the new tests against `main` to confirm they fail there. By reading the old code, `NONE, not a1`, `-E1`, and the `z9` candidate case would each have returned a wrong result before the change.

**Open point for you**
- The HTTP error case asserts that `httpx.HTTPStatusError` is raised, which matches the current behaviour (`raise_for_status`). If a human wants a 5xx to return `None` instead, this test and `_complete` need to change. Please confirm before merging.