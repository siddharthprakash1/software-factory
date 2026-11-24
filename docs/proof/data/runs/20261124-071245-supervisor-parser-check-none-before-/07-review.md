The diff does what the issue asks. I found no real defects, so the verdict is approve, with two non-blocking test-gap notes.

**Issue items**
1. **NONE first:** `choose` checks `_is_none(text)` before `_parse`, so `NONE, not a1` returns `None`. Behaviour change to note: `a1 or NONE` now also abstains. That follows from "NONE must win", and the new test asserts it.
2. **Unknown ids:** `allowed` is filtered to ids in `state.options`. `build_choose_prompt` already drops unknown ids (`if i in labels`), so prompt and parser now agree.
3. **Hyphen:** the lookbehind is now `(?<!\w)`, so `-E1` parses as `E1`. The trailing `(?![\w-])` is unchanged, so `E1-` and `E1x` still don't match. `_is_none` keeps its original lookbehind, so `-NONE` still isn't an abstention.
4. **Tests:** the parametrized `test_parse_cases` covers `E12`/`E1`, trailing punctuation, `-E1`, both NONE orderings, unknown ids and the `E1x` boundary. `test_http_error_raises` covers the 500 path.

**Non-blocking notes**
- The issue asks for one parametrized test that covers the HTTP error path. The 500 case is a separate non-parametrized test. It is still correct, so this is a matter of placement.
- The hyphen boundary was widened, but its adjacent case isn't pinned. Nothing asserts that `E1-` still fails, or that `-NONE` still doesn't abstain. Adding those would lock in the boundary.
- Fallback mode now abstains if an uppercase `NONE` appears anywhere in the last 200 characters of reasoning, even when a valid id follows it. That is the consequence of item 1 and is not covered by a test.

Nothing in the diff was deleted, skipped or weakened. Test-file changes are additions only, and the imports are used.

```json
{"verdict": "approve", "summary": "All four issue items are implemented in the supervisor parser, and the parametrized tests cover the requested cases. Changes are confined to client.py and test_supervisor.py. Remaining gaps are test-coverage notes, not defects.", "comments": ["The issue asks for one parametrized parse test that covers the HTTP error path. The 500 case is a separate non-parametrized test (test_http_error_raises). Consider folding it in if the issue is read literally.", "The hyphen lookbehind was widened from (?<![\\w-]) to (?<!\\w), but no test pins the adjacent behaviour. Add cases such as 'E1-' (must stay None) and '-NONE' (must not abstain) to guard the boundary, as the repo lessons require.", "Fallback reasoning text is now checked for NONE before candidate ids. An uppercase NONE anywhere in the last 200 chars of reasoning overrides a later valid id. This follows from item 1, but no test documents it."], "out_of_scope": []}
```