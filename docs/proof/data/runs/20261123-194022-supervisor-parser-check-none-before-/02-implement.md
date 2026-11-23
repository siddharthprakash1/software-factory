All four parser issues are fixed in `src/surety/supervise/client.py`, with tests in `tests/test_supervisor.py`. `uv run pytest -q` passes (194 passed, 1 skipped), and `test_supervisor.py`, `test_h3.py` and `test_runner.py` pass on their own too (54 tests).

**Changes**

1. **NONE wins.** `choose` now checks `_is_none(text)` before parsing. `NONE, not a1` returns `None` with `usage.abstained=True`.
2. **Out-of-options ids are dropped.** `allowed` is filtered to ids present in `state.options`, so an id like `X9` passed in `candidate_ids` is treated as unparsed.
3. **Hyphen-prefixed ids parse.** The `_parse` lookbehind changed from `(?<![\w-])` to `(?<!\w)`. `_is_none` got the same lookbehind so the two stay consistent. The lookahead `(?![\w-])` is unchanged, so `E1-x` still doesn't match `E1`.
4. **Tests.** A parametrized `test_choose_parse_cases` covers `E1` vs `E12`, trailing punctuation, `NONE, not a1` (both orders), `-E1`, and an unknown id. `test_choose_drops_candidate_not_in_options` covers the out-of-options case. `test_choose_propagates_http_error` asserts that a 500 raises `httpx.HTTPStatusError`.

**Judgement calls**

- **HTTP error path.** The test asserts that `httpx.HTTPStatusError` propagates. This is the existing behaviour, since `_complete` calls `raise_for_status()` and nothing catches it. I read that as intended, but I did not confirm it with the issue author.
- **Fallback path ordering.** A `NONE` anywhere in the reasoning fallback text now wins over a later candidate id. The triage plan asked for this order, and the existing fallback tests still pass.
- **Red before green.** I did not re-run the new tests against the old code. By reading the old code, `NONE, not a1`, `-E1`, and the `X9` candidate case would each have failed.

I did not commit or push.