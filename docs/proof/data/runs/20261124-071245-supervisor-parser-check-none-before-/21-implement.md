The supervisor fix and its tests were already in this worktree from earlier attempts, and I left them as they are. The full suite passes: `uv run pytest -q` gives 194 passed, 1 skipped.

**What the code does now** (`src/surety/supervise/client.py`):
1. **NONE wins:** `choose` checks `_is_none(text)` first. When it matches, the answer is `None` and `usage.abstained` is set, so `NONE, not a1` no longer resolves to `a1`.
2. **Unknown ids are rejected:** candidate ids are filtered to those in `state.options`, so an id outside the options is treated as unparsed.
3. **Hyphen-prefixed ids parse:** the id lookbehind is `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead `(?![\w-])` is unchanged, so `E1x` and `E1-` still don't match.

**Tests** (`tests/test_supervisor.py`): a parametrized `test_parse_cases` covers `E12`, `E1`, `E1.`, `answer: E1, done`, `-E1`, `NONE, not a1`, unknown `Z9`, `E1x`, an out-of-options candidate `z9`, and an HTTP 500 that expects `httpx.HTTPStatusError`. `test_reasoning_fallback_none_is_abstention` covers NONE in the reasoning fallback.

**Two things for you to decide:**
- **The feedback conflicts with itself.** The bullet list asks for `test_reasoning_fallback_none_is_abstention` to be removed and the `ids`/`abstained` restructuring to be undone. The human guidance below it says to keep the `abstained` rename and the extra NONE tests. I followed the guidance, since it is the more specific and later instruction. If the bullets are what the reviewer meant, those two items need reverting.
- **The HTTP 500 expectation** asserts that `choose` raises. The triage plan asked for this to be confirmed before merging, unless a human wants `None` instead. I have not confirmed it.

I could not run ruff because it is not installed in this environment. I also did not re-run the new tests against the pre-change code, so "these would have failed before" is from reading the old code, not from a run.