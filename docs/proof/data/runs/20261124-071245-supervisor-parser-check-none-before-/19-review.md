The diff does what the issue asks. I found no defects, so I'm approving. Two things go beyond the issue, and I've listed them under `out_of_scope`.

**Checked against the issue**
1. **NONE first:** `choose()` now computes `_is_none(text)` before calling `_parse`, so `NONE, not a1` returns `None` and sets `abstained`.
2. **Ids not in `state.options`:** `allowed` is filtered to ids present in `state.options`, so `z9` with candidates `["z9", "a1"]` is rejected. The `candidate_ids=None` path is unchanged.
3. **Hyphen:** the lookbehind changed from `(?<![\w-])` to `(?<!\w)`, so `-E1` parses as `E1`. The trailing `(?![\w-])` is kept, so `E1x` and `E1-` still fail.
4. **Parametrized test:** `test_parse_cases` covers `E12`/`E1`, trailing punctuation, `answer: E1, done`, `-E1`, `NONE, not a1`, `Z9`, `E1x`, the filtered-candidate case, and the HTTP 500 path.

I traced the existing tests against the new code and they still hold. Changes are confined to `client.py` and `test_supervisor.py`, and no existing test was removed or weakened.

**Notes, not defects**
- The lookbehind change also lets an id match after any hyphen. For example, `E1-E12` now parses as `E12`, and `foo-E1` parses as `E1`. The issue asks for the hyphen case, so this is expected, but reviewers may want to know.
- `_is_none` keeps the old `(?<![\w-])` lookbehind, so `-NONE` still does not count as an abstention. That is unchanged behaviour and the issue does not name it.
- The reasoning-fallback path now abstains when a `NONE` appears anywhere in the fallback text, even if a candidate id also appears. This follows from item 1 as written.

```json
{"verdict": "approve", "summary": "The change implements all four issue items in client.py: NONE is checked first, candidates are filtered to state.options, the lookbehind accepts a hyphen before an id, and a parametrized test covers the named cases and the HTTP error path. No existing tests were removed or weakened, and the diff stays within the supervisor module and its tests.", "comments": [], "out_of_scope": ["New test function test_reasoning_fallback_none_is_abstention covers an unnamed boundary (NONE in reasoning fallback text winning over a candidate id); the issue names only the parametrized test.", "choose() introduces the locals `ids` and `abstained` and restructures the abstention assignment, which is more than the smallest in-place edit needed for the NONE-first fix."]}
```