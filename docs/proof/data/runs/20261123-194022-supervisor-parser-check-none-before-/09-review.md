The change does what the issue asks, and I found no real defects. I could not run the test suite: the sandbox denied `pytest` (it asked for approval), so the verdict rests on reading the code and tracing each test case by hand.

- **NONE first (item 1):** `choose` checks `_is_none(text)` before parsing, so `NONE, not a1` abstains. `E1 -NONE` is not an abstention, because the lookbehind rejects a hyphen before NONE.
- **Unknown candidates (item 2):** `allowed` is now `candidate_ids ∩ state.options`, so an id outside the options can never be returned. The prompt builder already filters on labels, so no prompt change is needed.
- **Hyphen prefix (item 3):** the lookbehind is now `(?<!\w)`, so `-E1` parses as `E1`. The trailing `(?![\w-])` is unchanged, so `E1-` still does not match.
- **Scope:** only `client.py` and `test_supervisor.py` changed. No caller of `choose` exists in `src`, so the changed abstention semantics affect nothing else in the repo.
- **Behaviour change:** a reply containing both a valid id and a bare `NONE` now abstains where it used to return the id. This is what item 1 asks for.
- **Tests:** I traced each parametrized case, the out-of-options test, and the HTTP error test (`raise_for_status` raises `HTTPStatusError`). All should pass. The existing fallback and reasoning tests are unaffected.

One gap against the issue wording: item 4 asks for one parametrized test that also covers the HTTP error path and the out-of-options case. Those two are separate test functions here. This is a coverage-shape point, not a defect, so it does not block approval.

```json
{"verdict": "approve", "summary": "The change implements all four parser fixes in the supervisor module: NONE is checked first, candidates outside state.options are dropped, hyphen-prefixed ids parse, and parse tests are added. Traced by hand, all new and existing cases should pass, but the test suite was not executed because running pytest was denied.", "comments": ["Non-blocking: item 4 asks for a single parametrized test covering the HTTP error path, but test_choose_propagates_http_error and test_choose_drops_candidate_not_in_options are separate functions. Folding them into the parametrized table would match the request more closely.", "Not verified by execution: run `pytest tests/test_supervisor.py` to confirm the new parametrized cases and the existing tests pass."]}
```