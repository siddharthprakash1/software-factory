# Supervisor parser: check NONE before candidate ids and reject ids not in state.options

- Run: 20261124-071245-supervisor-parser-check-none-before-
- Branch: `factory/20261124-071245-supervisor-parser-check-none-before-` in C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety
- PR: https://github.com/siddharthprakash1/surety/pull/4
- Attempts: 2, cost: $0.171
- Triage: automate / low - All four deferred minors sit in one parser function and its call site in supervise/client.py, with the existing httpx_mock test file as the test home. The change is a few lines plus one parametrized test.
- Review: The parser now checks NONE first, rejects candidate ids that are not in state.options, accepts a hyphen-preceded id such as -E1, and adds a parametrized test covering E1 vs E12, trailing punctuation, the three parser fixes and the HTTP error path. The change is confined to the supervisor module and its tests.

## Changes
```
src/surety/supervise/client.py | 10 ++++++----
 tests/test_supervisor.py       | 31 +++++++++++++++++++++++++++++++
 2 files changed, 37 insertions(+), 4 deletions(-)
```

## Verification
```
$ uv run pytest -q
........................................................................ [ 37%]
........................................................................ [ 74%]
.................................................                        [100%]
193 passed, 1 skipped in 21.01s


```

<details><summary>Run log: every step the factory took</summary>

| Step | Model | Outcome | Cost | Seconds |
|---|---|---|---|---|
| triage | haiku | automate/low | $0.010 | 26 |
| implement | haiku | attempt 1 committed | $0.014 | 72 |
| verify |  | passed |  | 24 |
| review | haiku | approve | $0.009 | 30 |
| implement | haiku | attempt 2 committed | $0.013 | 62 |
| verify |  | passed |  | 23 |
| review | haiku | approve | $0.011 | 31 |
| deliver |  | pr opened |  |  |
| learn | haiku | lessons updated | $0.005 | 12 |
| human |  | resumed with guidance |  |  |
| implement | haiku | attempt 1 committed | $0.009 | 69 |
| verify |  | passed |  | 24 |
| review | haiku | approve | $0.011 | 35 |
| implement | haiku | attempt 2 committed | $0.010 | 45 |
| verify |  | passed |  | 24 |
| review | haiku | approve | $0.011 | 30 |
| implement | haiku | attempt 3 committed | $0.014 | 60 |
| verify |  | passed |  | 24 |
| review | haiku | approve | $0.010 | 33 |
| human |  | resumed with guidance |  |  |
| implement | haiku | attempt 1 changed nothing | $0.010 | 63 |
| verify |  | passed |  | 24 |
| review | haiku | approve | $0.011 | 30 |
| implement | haiku | attempt 2 committed | $0.009 | 46 |
| verify |  | passed |  | 23 |
| review | haiku | approve | $0.012 | 39 |

</details>

Inspect: `git -C "C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\repos\surety" diff 792d60d7..factory/20261124-071245-supervisor-parser-check-none-before-`
