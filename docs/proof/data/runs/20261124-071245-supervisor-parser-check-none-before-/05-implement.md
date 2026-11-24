The supervisor parser fixes are in place, and `uv run pytest -q` passes (194 passed, 1 skipped). Nothing is committed.

**Changes in `src/surety/supervise/client.py`**
- **Abstention first (item 1):** `choose()` computes `_is_none(text)` and, when it matches, returns `None` with `usage.abstained = True` without calling `_parse`. So `NONE, not a1` now abstains instead of returning `a1`.
- **Options only (item 2):** `allowed` is filtered to ids present in `state.options`, so a candidate id outside the options is treated as unparsed.
- **Hyphen-prefixed ids (item 3):** the `_parse` lookbehind is `(?<!\w)`, so `-E1` parses as `E1`. The trailing lookahead and `_is_none` are unchanged.

The `choose()` body is otherwise the original shape, per the feedback.

**Changes in `tests/test_supervisor.py`**
- `test_parse_cases` is parametrized over `(reply, candidates, expected)`. It covers `E12` vs `E1`, trailing punctuation, `-E1`, `NONE, not a1`, `a1 or NONE`, unknown ids, `E1x`, and a candidate outside the options (`z9` with candidates `["z9", "a1"]`).
- I removed `test_none_in_reasoning_fallback_is_abstention` and `test_candidate_outside_options_is_unparsed`, as the feedback asked. The second case now lives in the parametrized test.

**Open points to confirm before merging**
- **HTTP error path:** not in the parametrized test. `test_http_error_raises` already covers a 500 raising `httpx.HTTPStatusError`, and I left it as is. Tell me if you want it folded in.
- **Reasoning-fallback `NONE`:** the triage plan asked for a test of it, but the feedback asked me to remove the standalone test. It is not covered by a dedicated test now. It goes through the same `_is_none` check as the content path.