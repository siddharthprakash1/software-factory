All four supervisor parser issues are fixed in `src/surety/supervise/client.py`, with tests in `tests/test_supervisor.py`. The full suite passes: `uv run pytest -q` gives 195 passed, 1 skipped. I did not run a linter because ruff is not installed in this environment.

**Changes**
1. **NONE wins over ids.** `Supervisor.choose` now checks `_is_none(text)` before parsing. `NONE, not a1` abstains instead of returning `a1`, and `abstained` is set directly.
2. **Unknown ids are unparsed.** The allowed list is now the candidate ids (or all options) filtered to ids present in `state.options`. A candidate such as `z9` that is not in the options is ignored.
3. **Hyphen-prefixed ids parse.** The id lookbehind changed from `(?<![\w-])` to `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead and `_is_none` are unchanged, so `E1-x` still doesn't match and `NONE` boundaries are unaffected.
4. **Tests.** I added a parametrized `test_parse_cases` covering `E12`, `E1`, `E1.`, `answer: E1, done`, `-E1`, `NONE, not a1`, `a1 or NONE`, `Z9` and `E1x`. I also added tests for a `NONE` inside the reasoning fallback, a candidate outside the options, and an HTTP 500 that raises `httpx.HTTPStatusError`.

**Decision to confirm:** the HTTP test asserts that a 5xx still raises, which is the existing behaviour (`raise_for_status`). The issue asks for the error path to be covered, not changed, so I kept it. If you want a 5xx to return `None` instead, that is a behaviour change and the test would need to flip.

I did not commit anything.