I could not run the test suite. Both `pytest` invocations were blocked by the permission gate, so this verdict rests on reading the code against the issue and the existing tests.

**Against the issue:**
1. **NONE wins:** `choose` now checks `_is_none` before parsing candidates, so `NONE, not a1` returns `None` with `abstained=True`. This is correct.
2. **Unknown ids are unparsed:** `allowed` is filtered to ids in `state.options`, so `X9` yields `None`. Correct.
3. **Hyphen-preceded ids:** the lookbehind is now `(?<!\w)`, so `-E1` parses as `E1`. The trailing `(?![\w-])` still rejects `E1-foo`. Correct.
4. **Tests:** the parametrized test covers `E1` vs `E12`, trailing punctuation, the three cases, and an unknown id. The HTTP error path is a separate test. `raise_for_status()` is called in `_complete`, so the `HTTPStatusError` assertion matches the code.

I traced the regex ordering by hand: `_pattern` sorts by length descending, so `E12.` matches `E12` and `E1.` matches `E1`. The existing tests, including the `httpx_mock` reuse pattern, are unaffected by the change.

**Non-blocking notes:**
- The HTTP error case is a separate test, not a row in the parametrized one. The issue's wording can be read either way, so this is a judgement call, not a defect.
- The prompt still shows candidate ids that are not in `state.options`. Only the parse was asked to change, so this is fine.
- `NONE` now overrides any valid id, including in the reasoning-fallback path where `last=True`. That is what the issue asks for, but a reasoning trace containing an uppercase `NONE` will now abstain where it previously returned a candidate.
- `_is_none` also drops the hyphen exclusion, so `-NONE` now counts as abstention. This is a small change beyond the four listed items and is consistent with item 3.

```json
{"verdict": "approve", "summary": "The change implements all four requested parser fixes, confined to the supervisor client and its tests. I could not run the suite (permission denied), so the verdict rests on reading the regex ordering and the httpx_mock usage against the code.", "comments": ["Tests were not executed because the pytest command was blocked by the permission gate; run tests/test_supervisor.py before merging.", "The HTTP error path is a separate test rather than a case in the parametrized parse test; if the issue meant one parametrized test to cover it, that is a minor deviation.", "Candidate ids not in state.options are still shown to the model in the prompt; only parsing rejects them. Acceptable, but worth knowing.", "NONE now overrides any valid id even in the reasoning-fallback path (last=True), so an uppercase NONE in a reasoning trace causes abstention where a candidate was previously returned. This follows the issue's rule but is a behaviour change to note.", "_is_none also drops the hyphen exclusion, so '-NONE' now counts as abstention; this goes slightly beyond the four listed items."]}
```