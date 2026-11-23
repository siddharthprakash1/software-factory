# Supervisor parser: check NONE before candidate ids and reject ids not in state.options

- Run: 20261123-194022-supervisor-parser-check-none-before-
- Branch: `factory/20261123-194022-supervisor-parser-check-none-before-` in C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety
- PR: https://github.com/siddharthprakash1/surety/pull/4
- Attempts: 1, cost: $0.055
- Triage: automate / low - Four small, well-specified fixes to the parse logic in one module plus one test file; the current behaviour and the failing cases are reproducible by reading the code. Tests have not been run.
- Review: The change implements all four parser fixes in the supervisor module: NONE is checked first, candidates outside state.options are dropped, hyphen-prefixed ids parse, and parse tests are added. Traced by hand, all new and existing cases should pass, but the test suite was not executed because running pytest was denied.

## Changes
```
src/surety/supervise/client.py | 12 +++++++-----
 tests/test_supervisor.py       | 41 +++++++++++++++++++++++++++++++++++++++++
 2 files changed, 48 insertions(+), 5 deletions(-)
```

## Verification
```
$ uv run pytest -q
........................................................................ [ 36%]
........................................................................ [ 73%]
...................................................                      [100%]
195 passed, 1 skipped in 23.89s


```

Inspect: `git -C "C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety" diff 006f1805..factory/20261123-194022-supervisor-parser-check-none-before-`
