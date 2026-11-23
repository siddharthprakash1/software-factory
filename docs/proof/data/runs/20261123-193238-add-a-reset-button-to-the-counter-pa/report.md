# Add a Reset button to the counter page

- Run: 20261123-193238-add-a-reset-button-to-the-counter-pa
- Branch: `factory/20261123-193238-add-a-reset-button-to-the-counter-pa` in C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\demo-site
- Attempts: 1, cost: $0.203
- Triage: automate / low - The issue specifies the method name, the target file, the reset-to-0 behavior, and the button location, and the change is confined to one method, one test, and one button in three small files. The existing node:test suite can verify it.
- Review: reset() sets the counter to 0, the button is wired to it in index.html next to the existing controls, and a meaningful test covers it. Nothing unrelated is touched. The test suite could not be run in this session, so the verdict is based on reading the code.
- Browser check: Page shows -1, Reset and +1 buttons. After three +1 clicks the count was 3, and clicking Reset returned it to 0. The screenshot is saved in the workspace root as ui-attempt-1.png, not at the requested runs path, because the tool blocked that path.

## Changes
```
index.html            | 2 ++
 src/counter.mjs       | 3 +++
 test/counter.test.mjs | 9 +++++++++
 3 files changed, 14 insertions(+)
```

## Verification
```
$ npm test

> demo-site@1.0.0 test
> node --test

TAP version 13
# Subtest: increments and decrements
ok 1 - increments and decrements
  ---
  duration_ms: 1.2127
  ...
# Subtest: reset sets the value back to 0
ok 2 - reset sets the value back to 0
  ---
  duration_ms: 0.2164
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 126.3679


```

Inspect: `git -C "C:\Users\DELL\Desktop\PROJECTS\AI projects\factory ai space\.factory\demo-site" diff 3dbddfa5..factory/20261123-193238-add-a-reset-button-to-the-counter-pa`
