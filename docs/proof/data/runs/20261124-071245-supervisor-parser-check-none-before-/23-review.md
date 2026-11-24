The change does what the issue asks, and I found no correctness defects. The factory's `uv run pytest -q` run already passed on this change.

- **NONE first (item 1):** `choose` now computes `abstained = _is_none(text)` and forces `chosen = None` when it is set, so `NONE, not a1` returns `None`. Abstention is recorded as before.
- **Unknown ids (item 2):** with `candidate_ids`, `allowed` is intersected with `state.options`, so `z9` against `["z9", "a1"]` is unparsed. With `candidate_ids=None`, `allowed` is already all option ids, so behaviour there is unchanged.
- **Hyphen (item 3):** the id lookbehind changed from `(?<![\w-])` to `(?<!\w)`, so `-E1` parses as `E1`. The trailing `(?![\w-])` is kept, so `E1x` and `E1-…` still do not match. `_is_none` keeps its hyphen lookbehind, which is unchanged and not in the issue.
- **Tests (item 4):** `test_parse_cases` covers `E12`/`E1`, trailing `.`, `-E1`, `NONE, not a1`, unknown `Z9`, the `E1x` adjacency case, the disallowed candidate `z9`, and the HTTP 500 path. No existing test was removed, skipped or weakened. The only caller of `abstained` is `eval/analyze.py:229`, which is consistent with the new semantics.

One judgement call: `test_reasoning_fallback_none_is_abstention` covers a boundary the issue does not name, so I list it as out of scope below. I would not block on it.

```json
{"verdict": "approve", "summary": "NONE is checked before candidate parsing, candidate ids are intersected with state.options, and the hyphen lookbehind is relaxed for ids only, as the issue asks. The parametrized test covers the named boundaries and the HTTP error path, and no existing tests were weakened.", "comments": [], "out_of_scope": ["test_reasoning_fallback_none_is_abstention adds a test for a reasoning-fallback boundary the issue does not name; it should be removed or moved to a follow-up."]}
```